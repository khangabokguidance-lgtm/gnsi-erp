/**
 * GNSI Portal — Exams.jsx (v7 — Full Mobile Responsive)
 *
 * KEY CHANGES from v6:
 *  ① useMobile() hook drives all layout decisions
 *  ② TabNav — hamburger drawer properly triggered on mobile
 *  ③ MarkEntry — sticky name col, scrollable table, stacked controls
 *  ④ MarksGrid — sticky name col, scrollable table
 *  ⑤ Analytics — 2-col stat cards, charts stack on mobile
 *  ⑥ Rankings — 1-col podium on mobile, scrollable table
 *  ⑦ ProgressTab — stacked panels on mobile
 *  ⑧ CompareTab — stacked panels, 2-col compare cards
 *  ⑨ BulkReports — stacked settings+preview on mobile
 *  ⑩ Schedule — all mode grids stack on mobile
 *  ⑪ SeatArrangement — stacked + canvas scrollable
 *  ⑫ ExamTypesManager — stacked on mobile
 *  ⑬ ExamHubHeader — 2×2 stats on mobile
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from './supabase'
import { staffDB, useStaffDB } from './staffDB'
import { ADMIT_CARD_CSS, generateAdmitCardHTML, openAdmitCardPrintWindow } from './admitCardTemplate'
import ToppersCertificate from './ToppersCertificate'
import ExamDashboard from './ExamDashboard'
import './mobile.css';
import ExamCSVImport from './lib/ExamCSVImport';

// ─── Load Chart.js + SheetJS from CDN ────────────────────────────────────────
function loadScript(src, id) {
  return new Promise(res => {
    if (document.getElementById(id)) return res();
    const s = document.createElement("script");
    s.src = src; s.id = id; s.onload = res;
    document.head.appendChild(s);
  });
}
async function ensureLibs() {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", "_xlsx");
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js", "_chartjs");
}

// ─── Default per-course subjects ──────────────────────────────────────────────
const DEFAULT_COURSE_SUBJECTS = {
  ACHIEVER:  ["English Grammar", "Vocabulary", "General Knowledge", "Mathematics -I", "Mathematics - II", "Reasoning", "Science"],
  ELITE:     ["English Grammar", "Science", "Mathematics", "Reasoning", "Meitei Mayek"],
  PRIME:     ["English Grammar", "Science", "Mathematics", "Reasoning", "Meitei Mayek"],
  LAKSHYA:   ["Grammar", "Mental", "Mathematics", "Meitei Mayek"],
  UMEED:     ["Grammar & Vocabulary", "Mental", "Mathematics", "Meitei Mayek"],
  CHAMPION:  ["Vocabulary", "General Knowledge", "Mathematics-II", "Mathematics - I", "Reasoning", "Grammar", "Science"],
  LEADER:    ["Vocabulary", "Grammar", "General Knowledge", "Mathematics -I", "Mathematics - II", "Reasoning", "Science"],
};

// ─── Max marks per subject per course (all total to 100) ─────────────────────
const COURSE_MAX_MARKS = {
  ACHIEVER:  { "English Grammar": 10, "Vocabulary": 10, "General Knowledge": 10, "Mathematics -I": 20, "Mathematics - II": 20, "Reasoning": 20, "Science": 10 },
  ELITE:     { "English Grammar": 20, "Science": 15, "Mathematics": 30, "Reasoning": 20, "Meitei Mayek": 15 },
  PRIME:     { "English Grammar": 20, "Science": 15, "Mathematics": 30, "Reasoning": 20, "Meitei Mayek": 15 },
  LAKSHYA:   { "Grammar": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  UMEED:     { "Grammar & Vocabulary": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  CHAMPION:  { "Vocabulary": 10, "General Knowledge": 10, "Mathematics-II": 20, "Mathematics - I": 20, "Reasoning": 20, "Grammar": 10, "Science": 10 },
  LEADER:    { "Vocabulary": 10, "Grammar": 10, "General Knowledge": 10, "Mathematics -I": 20, "Mathematics - II": 20, "Reasoning": 20, "Science": 10 },
};

function getCourseMax(course) {
  const maxMap = ((window.__gnsiCourseMaxMarks || COURSE_MAX_MARKS)[course]) || {};
  return Object.values(maxMap).reduce((s, v) => s + v, 0) || 100;
}

function getSubjectMax(course, subject) {
  return ((window.__gnsiCourseMaxMarks || COURSE_MAX_MARKS)[course] || {})[subject] || 100;
}

// ─── Grade presets ────────────────────────────────────────────────────────────
const GRADE_PRESETS = [
  { min: 90, label: "A+", color: "#0F6E56", bg: "#E1F5EE", gpa: 4.0 },
  { min: 80, label: "A",  color: "#185FA5", bg: "#E6F1FB", gpa: 3.5 },
  { min: 70, label: "B+", color: "#534AB7", bg: "#EEEDFE", gpa: 3.0 },
  { min: 60, label: "B",  color: "#2563eb", bg: "#dbeafe", gpa: 2.5 },
  { min: 50, label: "C",  color: "#BA7517", bg: "#FAEEDA", gpa: 2.0 },
  { min: 40, label: "D",  color: "#ea580c", bg: "#fff7ed", gpa: 1.0 },
  { min: 0,  label: "F",  color: "#A32D2D", bg: "#FCEBEB", gpa: 0.0 },
];

// ─── Role permissions ─────────────────────────────────────────────────────────
function usePerm(currentUser, perms) {
  if (perms) {
    return {
      canEdit:   perms.edit   !== false,
      canDelete: perms.delete !== false,
      canImport: perms.add    !== false,
      canPrint:  perms.read   !== false,
    }
  }
  const role = currentUser?.role
  if (role === 'Admin')    return { canEdit:true,  canDelete:true,  canImport:true,  canPrint:true  }
  if (role === 'Manager')  return { canEdit:true,  canDelete:false, canImport:true,  canPrint:true  }
  if (role === 'Accounts') return { canEdit:true,  canDelete:false, canImport:true,  canPrint:true  }
  return                          { canEdit:true,  canDelete:false, canImport:false, canPrint:true  }
}

const TAB_GROUPS = [
  {
  groupLabel: "Entry", color: "#1433a8",
  tabs: [
    { id: "entry",     icon: "✏️", label: "Mark Entry",  tip: "Enter & save marks" },
    { id: "csvimport", icon: "📂", label: "CSV Import",   tip: "Smart CSV / Excel import" },
  ]
},
  {
    groupLabel: "Results", color: "#0891b2",
    tabs: [
      { id: "marks",     icon: "📊", label: "Marks Grid",  tip: "View all marks" },
      { id: "analytics", icon: "📉", label: "Analytics",   tip: "Charts & class analysis" },
      { id: "rankings",  icon: "🏆", label: "Rankings",    tip: "Top performers" },
      { id: "progress",  icon: "🎓", label: "Progress",    tip: "Per-student progress" },
      { id: "compare",   icon: "⚖️",  label: "Compare",    tip: "Side-by-side comparison" },
      { id: "merit",     icon: "📜", label: "Merit List",  tip: "Generate merit lists" },
      { id: "dashboard", icon: "🏠", label: "Dashboard",   tip: "Exam HUB overview" }
    ]
  },
  {
    groupLabel: "Documents", color: "#16a34a",
    tabs: [
      { id: "admitcard",  icon: "🪪",  label: "Admit Cards",  tip: "Generate admit cards" },
      { id: "reportcard", icon: "📋", label: "Report Cards", tip: "Print report cards" },
      { id: "bulkreport", icon: "📦", label: "Bulk Reports", tip: "Batch report generation" },
      { id: "toppers",    icon: "🏅", label: "Certificates", tip: "Print topper certificates" }
    ]
  },
  {
    groupLabel: "Schedule", color: "#d97706",
    tabs: [
      { id: "schedule",  icon: "📅", label: "Schedule",         tip: "Exam timetable" },
      { id: "seatplan",  icon: "🪑", label: "Seat Arrangement", tip: "Assign seats & rooms" },
    ]
  },
  {
    groupLabel: "Setup", color: "#7c3aed",
    tabs: [
      { id: "studentsmgr",    icon: "👤", label: "Students",        tip: "Add & manage students" },
      { id: "coursesubjects", icon: "📚", label: "Course Subjects",  tip: "Subjects per course/batch" },
      { id: "examtypes",      icon: "⚙️",  label: "Exam Types",      tip: "Configure exam types" },
      { id: "examconfig", icon: "🗂️", label: "Exam Config", tip: "Switch exam mark schemes" },
      { id: "settings",       icon: "🔧", label: "Settings",        tip: "Grading & institute config" },
    ]
  },
];

const INSTITUTE_DEFAULT = {
  name: "Guidance Navodaya & Sainik Institute",
  address: "Khangabok Sorok Wangma Thoubal, Manipur -795138",
  tagline: "A Premier Institute for Navodaya, Sainik & RMS Preparation since 2016",
  principal: "Principal",
  teacher: "Class Teacher",
  logoUrl: "https://postimg.cc/HrDFYwKn",
  academicYear: "2026-2027",
  examDate: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getGrade(pct, scale = GRADE_PRESETS) {
  for (const g of scale) if (pct >= g.min) return g;
  return scale[scale.length - 1];
}

function calcPct(total, course) {
  const max = getCourseMax(course);
  return (total / max) * 100;
}

function printHTML(html, title = "GNSI") {
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    :root{--bg:#F7F6F1;--bg2:#EDEAE2;--border:#D5D0C5;--text:#1C1A16;--text2:#6B6657;--accent:#2A5C45;--gold:#B8860B;}
    body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);padding:28px;-webkit-font-smoothing:antialiased;}
    .page{max-width:720px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);}
    .header{background:linear-gradient(135deg,#1a3c2e 0%,#2A5C45 60%,#3a7a5c 100%);color:#fff;padding:28px 36px 22px;text-align:center;position:relative;}
    .header::after{content:'';display:block;position:absolute;bottom:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#B8860B,#f0c040,#B8860B);}
    .eyebrow{font-size:10px;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,.65);margin-bottom:6px;}
    .inst-name{font-family:'Playfair Display',Georgia,serif;font-size:24px;font-weight:400;margin-bottom:4px;}
    .inst-addr{font-size:12px;color:rgba(255,255,255,.7);}
    .exam-pill{display:inline-block;margin-top:10px;font-size:12px;font-weight:500;background:rgba(255,255,255,.15);border-radius:20px;padding:4px 16px;color:rgba(255,255,255,.9);}
    .body{padding:28px 36px;}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:22px;font-size:13px;}
    .info-cell{padding:11px 16px;border-bottom:1px solid var(--border);border-right:1px solid var(--border);}
    .info-cell:nth-child(even){border-right:none;}
    .info-cell:nth-last-child(-n+2){border-bottom:none;}
    .info-label{font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:var(--text2);margin-bottom:3px;font-weight:600;}
    .info-value{font-weight:600;font-size:14px;}
    table{width:100%;border-collapse:collapse;border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:18px;}
    thead tr{background:#1a3c2e;color:#fff;}
    thead th{padding:10px 14px;font-weight:600;font-size:10.5px;letter-spacing:1.5px;text-transform:uppercase;text-align:center;}
    thead th:first-child{text-align:left;}
    tbody td{padding:9px 12px;text-align:center;border-bottom:1px solid var(--border);}
    tbody td:first-child{text-align:left;font-weight:500;}
    tbody tr:last-child td{border-bottom:none;}
    .total-row{background:var(--bg2);font-weight:700;}
    .summary{display:flex;gap:12px;margin-bottom:22px;}
    .sum-card{flex:1;text-align:center;border-radius:10px;padding:14px 10px;border:1px solid var(--border);}
    .sum-label{font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:var(--text2);margin-bottom:8px;font-weight:600;}
    .sum-value{font-family:'Playfair Display',Georgia,serif;font-size:32px;font-weight:600;line-height:1;}
    .footer{display:flex;justify-content:space-between;align-items:flex-end;border-top:1px dashed var(--border);padding-top:18px;margin-top:4px;}
    .sig{text-align:center;}
    .sig-line{border-top:1.5px solid var(--text);width:140px;padding-top:5px;font-size:10.5px;color:var(--text2);letter-spacing:1.5px;text-transform:uppercase;font-weight:600;}
    .stamp{width:64px;height:64px;border-radius:50%;border:2px dashed var(--border);display:flex;align-items:center;justify-content:center;font-size:9px;color:var(--text2);text-align:center;line-height:1.4;}
    .badge{border-radius:4px;padding:3px 10px;font-weight:600;font-size:11.5px;display:inline-block;}
    .no-print{display:none;}
    @media print{body{background:#fff;padding:0;}.page{box-shadow:none;border-radius:0;}@page{margin:1cm;}.no-print{display:none;}}
  </style></head><body>
  <div class="no-print" style="margin-bottom:14px;text-align:center;">
    <button onclick="window.print()" style="padding:10px 24px;background:#1a3c2e;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:14px;">🖨️ Print / Save as PDF</button>
  </div>
  ${html}</body></html>`);
  w.document.close();
}

const css = {
  card:  { background: "white", border: "1px solid #E5E7EB", borderRadius: 12, padding: 20, marginBottom: 16, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" },
  input: { padding: "7px 11px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box", color: "#111827", fontFamily: "'DM Sans',sans-serif" },
  btn:   { padding: "8px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
};

// ─── Micro-components ─────────────────────────────────────────────────────────
function Spinner({ small }) {
  return <div style={{ padding: small ? 8 : 40, textAlign: "center", color: "#9CA3AF", fontSize: small ? 12 : 14 }}>⏳ Loading…</div>;
}
function Badge({ label, color, bg }) {
  return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, color, background: bg }}>{label}</span>;
}
function SaveBtn({ onClick, saving, saved, label = "Save" }) {
  return (
    <button onClick={onClick} disabled={saving} style={{ ...css.btn, background: saved ? "#16A34A" : saving ? "#93C5FD" : "#1D4ED8", color: "white" }}>
      {saved ? "✓ Saved!" : saving ? "Saving…" : `💾 ${label}`}
    </button>
  );
}

// ─── Course selector pill bar ─────────────────────────────────────────────────
function CoursePicker({ courses, value, onChange, label = "Batch / Course" }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase" }}>{label}</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {courses.map(c => (
          <button key={c} onClick={() => onChange(c)}
            style={{ ...css.btn, padding: "6px 14px", background: value === c ? "#1a3c2e" : "#F3F4F6", color: value === c ? "white" : "#374151", border: value === c ? "none" : "1px solid #E5E7EB", fontSize: 12 }}>
            {c}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── DashStatCard ─────────────────────────────────────────────────────────────
function DashStatCard({ label, value, sub, color, strip }) {
  const strips = {
    blue: "linear-gradient(90deg,#185FA5,#4A90D9)", green: "linear-gradient(90deg,#0F6E56,#2A9D8F)",
    gold: "linear-gradient(90deg,#B8860B,#f0c040)", purple: "linear-gradient(90deg,#534AB7,#7B68EE)",
    red:  "linear-gradient(90deg,#A32D2D,#DC4444)", teal: "linear-gradient(90deg,#0891b2,#38bdf8)",
  };
  return (
    <div style={{ background: "white", borderRadius: 12, padding: "16px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: strips[strip] || strips.blue }} />
      <div style={{ fontSize: 10.5, fontWeight: 700, color: color || "#6B7280", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10, marginTop: 2 }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 34, fontWeight: 600, lineHeight: 1, color: color || "#1e293b", letterSpacing: "-.5px", marginBottom: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: "#9CA3AF" }}>{sub}</div>}
    </div>
  );
}

// ─── Mobile hook ──────────────────────────────────────────────────────────────
function useWindowWidth() {
  const [width, setWidth] = React.useState(
    typeof window !== "undefined" ? window.innerWidth : 1200
  );
  React.useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return width;
}

function useMobile() {
  return useWindowWidth() < 768;
}

function TabNav({ active, onSelect, perms, isAdmin }) {
  const isMobile = useMobile();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const SETUP_TABS = ["studentsmgr", "coursesubjects", "examtypes", "settings"];
  const WRITE_TABS = ["entry", "schedule", "seatplan"];
  const DOC_TABS   = ["admitcard", "reportcard", "bulkreport", "toppers"];

  const canShow = (tabId) => {
    if (isAdmin) return true;
    const p = perms || {};
    if (SETUP_TABS.includes(tabId)) return p.edit === true;
    if (WRITE_TABS.includes(tabId)) return p.add === true || p.edit === true;
    if (DOC_TABS.includes(tabId))   return p.read === true;
    return p.read === true;
  };

  const filteredGroups = TAB_GROUPS
    .map((g) => ({ ...g, tabs: g.tabs.filter((t) => canShow(t.id)) }))
    .filter((g) => g.tabs.length > 0);

  const activeTabInfo = TAB_GROUPS.flatMap((g) => g.tabs).find((t) => t.id === active);

  const handleSelect = (id) => { onSelect(id); setMenuOpen(false); };

  // ── MOBILE ──────────────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <>
        {/* Sticky top bar */}
        <div style={{
          background: "white",
          borderBottom: "1px solid #E5E7EB",
          padding: "0 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: 50,
          boxShadow: "0 2px 6px rgba(0,0,0,0.05)",
          position: "sticky",
          top: 0,
          zIndex: 100,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{activeTabInfo?.icon}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1a3c2e", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {activeTabInfo?.label}
            </span>
          </div>
          <button
            onClick={() => setMenuOpen((p) => !p)}
            style={{
              background: menuOpen ? "#1a3c2e" : "#F3F4F6",
              border: "none",
              borderRadius: 8,
              width: 38,
              height: 38,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "background .15s",
            }}
            aria-label="Toggle navigation"
          >
            {menuOpen
              ? <span style={{ fontSize: 16, color: "white", lineHeight: 1 }}>✕</span>
              : <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width: 18, height: 2, background: "#374151", borderRadius: 2 }} />)}
                </div>
            }
          </button>
        </div>

        {/* Full-screen drawer */}
        {menuOpen && (
          <div style={{
            position: "fixed", inset: 0, zIndex: 200,
            display: "flex", flexDirection: "column",
          }}>
            {/* Backdrop */}
            <div
              onClick={() => setMenuOpen(false)}
              style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)" }}
            />
            {/* Drawer panel */}
            <div style={{
              position: "relative",
              background: "white",
              maxHeight: "88vh",
              overflowY: "auto",
              borderBottomLeftRadius: 20,
              borderBottomRightRadius: 20,
              boxShadow: "0 12px 40px rgba(0,0,0,0.22)",
              zIndex: 1,
            }}>
              {/* Drawer header */}
              <div style={{
                background: "linear-gradient(135deg,#1a3c2e,#2A5C45)",
                padding: "14px 18px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                position: "sticky",
                top: 0,
                zIndex: 2,
              }}>
                <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, color: "white" }}>
                  🎓 Navigation
                </span>
                <button
                  onClick={() => setMenuOpen(false)}
                  style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6, padding: "4px 10px", color: "white", cursor: "pointer", fontSize: 14 }}
                >✕</button>
              </div>

              {/* Tab groups */}
              {filteredGroups.map((grp, gi) => (
                <div key={grp.groupLabel} style={{ padding: "10px 14px 0" }}>
                  <div style={{
                    fontSize: 9.5, fontWeight: 800, color: grp.color,
                    textTransform: "uppercase", letterSpacing: ".14em",
                    marginBottom: 7, paddingLeft: 2,
                  }}>
                    {grp.groupLabel}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 10 }}>
                    {grp.tabs.map((t) => {
                      const isActive = active === t.id;
                      return (
                        <button
                          key={t.id}
                          onClick={() => handleSelect(t.id)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 7,
                            padding: "9px 10px",
                            borderRadius: 9,
                            border: isActive ? "none" : "1px solid #E5E7EB",
                            background: isActive ? "#1a3c2e" : "#F9FAFB",
                            color: isActive ? "white" : "#374151",
                            cursor: "pointer",
                            fontFamily: "'DM Sans',sans-serif",
                            fontWeight: isActive ? 700 : 500,
                            fontSize: 12,
                            textAlign: "left",
                            transition: "all .1s",
                          }}
                        >
                          <span style={{ fontSize: 15, flexShrink: 0 }}>{t.icon}</span>
                          <span style={{ lineHeight: 1.25 }}>{t.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  {gi < filteredGroups.length - 1 && (
                    <div style={{ height: 1, background: "#F1F5F9", margin: "0 2px 10px" }} />
                  )}
                </div>
              ))}
              <div style={{ height: 20 }} />
            </div>
          </div>
        )}
      </>
    );
  }

  // ── DESKTOP (unchanged two-row layout) ──────────────────────────────────────
  const row1 = filteredGroups.filter((g) => ["Entry", "Results", "Documents"].includes(g.groupLabel));
  const row2 = filteredGroups.filter((g) => ["Schedule", "Setup"].includes(g.groupLabel));

  const Divider = () => (
    <div style={{ width: 1, height: 36, background: "#E5E7EB", margin: "0 6px", flexShrink: 0 }} />
  );

  const renderGroup = (grp) => (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", padding: "0 4px" }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: grp.color, textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 3 }}>
        {grp.groupLabel}
      </div>
      <div style={{ display: "flex", gap: 2 }}>
        {grp.tabs.map((t) => (
          <button key={t.id} onClick={() => onSelect(t.id)} title={t.tip}
            style={{
              padding: "5px 10px", fontSize: 12,
              background: active === t.id ? "#1a3c2e" : "transparent",
              color: active === t.id ? "white" : "#374151",
              border: active === t.id ? "none" : "1px solid transparent",
              borderRadius: 7, cursor: "pointer",
              fontFamily: "'DM Sans',sans-serif", fontWeight: 600,
            }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
    </div>
  );

  const renderRow = (groups) => (
    <div style={{ display: "flex", alignItems: "center", gap: 0, overflowX: "auto", scrollbarWidth: "none" }}>
      {groups.map((grp, i) => (
        <div key={grp.groupLabel} style={{ display: "flex", alignItems: "center" }}>
          {renderGroup(grp)}
          {i < groups.length - 1 && <Divider />}
        </div>
      ))}
    </div>
  );

  return (
    <div style={{
      background: "white", borderBottom: "1px solid #E5E7EB",
      padding: "10px 24px", display: "flex", flexDirection: "column", gap: 8,
      boxShadow: "0 2px 6px rgba(0,0,0,0.04)",
    }}>
      {renderRow(row1)}
      <div style={{ height: 1, background: "#F1F5F9", margin: "0 -4px" }} />
      {renderRow(row2)}
    </div>
  );
}

// ─── MARK ENTRY (mobile: scrollable table, stacked controls) ──────────────────

// ─── Remarks Hook ─────────────────────────────────────────────────────────────
function useRemarks(studentId, examTypeId, examDate) {
  const [remark, setRemark] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!studentId || !examTypeId || !examDate) return;
    supabase.from("exam_remarks").select("remark")
      .eq("student_id", studentId).eq("exam_type_id", examTypeId).eq("exam_date", examDate)
      .maybeSingle().then(({ data }) => { if (data?.remark) setRemark(data.remark); });
  }, [studentId, examTypeId, examDate]);

  const save = async (val) => {
    setSaving(true);
    await supabase.from("exam_remarks").upsert(
      { student_id: studentId, exam_type_id: examTypeId, exam_date: examDate, remark: val },
      { onConflict: "student_id,exam_type_id,exam_date" }
    );
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return { remark, setRemark, save, saving, saved };
}

function MarkEntry({ courseSubjects, examTypes, students, currentUser, perms }) {
  const isMobile = useMobile();
  const perm = usePerm(currentUser, perms);
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const subjects = courseSubjects[course] || [];
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course.toUpperCase() ||
    (s.course || "").toUpperCase() === course.toUpperCase()
  );
  const courseMax = getCourseMax(course);

  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState(new Date().toISOString().split("T")[0]);
  const [marks, setMarks] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [importMode, setImportMode] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importInfo, setImportInfo] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [absentSet, setAbsentSet] = useState(new Set());
  const fileInputRef = useRef(null);

  const fetchMarks = useCallback(async (typeId, date, crs) => {
    if (!typeId || !date || !crs) return;
    setLoading(true);
    const ids = students.filter(s =>
      (s.class_name || "").toUpperCase() === crs.toUpperCase() ||
      (s.course || "").toUpperCase() === crs.toUpperCase()
    ).map(s => s.id);
    if (!ids.length) { setMarks({}); setLoading(false); return; }
    const { data } = await supabase.from("exam_marks").select("*")
      .eq("exam_type_id", typeId).eq("exam_date", date).in("student_id", ids);
    const map = {};
    (data || []).forEach(r => { map[`${r.student_id}-${r.subject}`] = r.marks; });
    setMarks(map); setLoading(false);
  }, [students]);

  useEffect(() => { fetchMarks(examType, examDate, course); }, [examType, examDate, course]);

  const handleMark = (sid, sub, val) => { setMarks(p => ({ ...p, [`${sid}-${sub}`]: val })); setSaved(false); };
  const toggleAbsent = (sid, sub) => {
    const key = `${sid}-${sub}`;
    setAbsentSet(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else { next.add(key); setMarks(p => ({ ...p, [key]: 0 })); setSaved(false); }
      return next;
    });
  };
  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);

  const handleSave = async () => {
    setSaving(true);
    const rows = [];
    for (const st of courseStudents) {
      for (const sub of subjects) {
        const m = Number(marks[`${st.id}-${sub}`]);
        if (!isNaN(m)) rows.push({
          student_id: st.id, student_name: st.name, class_name: st.class_name,
          exam_type_id: examType, subject: sub, marks: m,
          total_marks: getSubjectMax(course, sub), exam_date: examDate,
        });
      }
    }
    for (let i = 0; i < rows.length; i += 100)
      await supabase.from("exam_marks").upsert(rows.slice(i, i + 100), { onConflict: "student_id,exam_type_id,subject,exam_date" });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const downloadTemplate = () => {
    const headers = ["Student Name", "GCC NO", ...subjects];
    const rows = courseStudents.map(st => [st.name, st.gcc_no || st.admission_no || "", ...subjects.map(() => "")]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `GNSI_Template_${course}_${examDate}.csv`;
    a.click();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return; e.target.value = "";
    await ensureLibs(); const XLSX = window.XLSX; let rows = [];
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "csv") {
      const text = await file.text();
      const lines = text.trim().split("\n").map(l => l.split(",").map(c => c.replace(/^"|"$/g, "").trim()));
      rows = lines;
    } else {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    }
    if (!rows.length) return;
    const headers = rows[0].map(h => String(h).trim());
    const courseCol = headers.findIndex(h => /^course$/i.test(h));
    let detectedCourse = course;
    if (courseCol !== -1 && rows.length > 1) {
      const raw = rows[1][courseCol]?.toString().trim().toUpperCase();
      if (raw && courseSubjects[raw]) detectedCourse = raw;
      else if (raw) { const match = Object.keys(courseSubjects).find(k => raw.includes(k) || k.includes(raw)); if (match) detectedCourse = match; }
    }
    const importSubjects = courseSubjects[detectedCourse] || subjects;
    const subjectCols = importSubjects.map(sub => ({ sub, col: headers.findIndex(h => h.toLowerCase().trim() === sub.toLowerCase().trim()) }));
    const nameCol = headers.findIndex(h => /name/i.test(h));
    const gccCol  = headers.findIndex(h => /gcc/i.test(h));
    const admCol  = headers.findIndex(h => /admission|adm|roll/i.test(h));
    if (nameCol === -1) { alert("Could not find a 'STUDENTS NAME' column."); return; }
    const allStudentsForCourse = students.filter(s => (s.class_name || "").toUpperCase() === detectedCourse || (s.course || "").toUpperCase() === detectedCourse);
    const matchPool = allStudentsForCourse.length ? allStudentsForCourse : students;
    const matched = []; const errors = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rawName = row[nameCol]?.toString().trim(); if (!rawName) continue;
      const rawGcc = gccCol !== -1 ? row[gccCol]?.toString().trim() : "";
      const rawAdm = admCol !== -1 ? row[admCol]?.toString().trim() : "";
      let student = rawGcc ? matchPool.find(s => String(s.gcc_no).trim() === rawGcc) : null;
      if (!student && rawAdm) student = matchPool.find(s => String(s.admission_no).trim() === rawAdm);
      if (!student) student = matchPool.find(s => s.name?.toLowerCase() === rawName.toLowerCase());
      if (!student) student = matchPool.find(s => s.name?.toLowerCase().startsWith(rawName.toLowerCase().slice(0, 8)));
      if (!student) { errors.push(rawName); continue; }
      const subMarks = {};
      subjectCols.forEach(({ sub, col }) => { if (col !== -1) { const v = Number(row[col]); if (!isNaN(v) && row[col] !== "") subMarks[sub] = v; } });
      matched.push({ student, subMarks });
    }
    setImportRows(matched); setImportErrors(errors);
    setImportInfo({ detectedCourse, subjects: importSubjects });
    setImportMode(true); setImportDone(false);
    if (detectedCourse !== course) setCourse(detectedCourse);
  };

  const confirmImport = async () => {
    setImporting(true);
    const importSubjects = importInfo?.subjects || subjects;
    const detCourse = importInfo?.detectedCourse || course;
    const rows = [];
    for (const { student: st, subMarks } of importRows) {
      for (const sub of importSubjects) {
        if (subMarks[sub] !== undefined) {
          rows.push({
            student_id: st.id, student_name: st.name, class_name: st.class_name,
            exam_type_id: examType, subject: sub, marks: subMarks[sub],
            total_marks: getSubjectMax(detCourse, sub), exam_date: examDate,
          });
        }
      }
    }
    for (let i = 0; i < rows.length; i += 100)
      await supabase.from("exam_marks").upsert(rows.slice(i, i + 100), { onConflict: "student_id,exam_type_id,subject,exam_date" });
    await fetchMarks(examType, examDate, importInfo?.detectedCourse || course);
    setImporting(false); setImportDone(true);
    setTimeout(() => { setImportMode(false); setImportRows([]); setImportErrors([]); setImportInfo(null); setImportDone(false); }, 2500);
  };

  const handleExport = async () => {
    await ensureLibs(); const XLSX = window.XLSX;
    const headers = ["Student", "Class", ...subjects, "Total", "%", "Grade"];
    const rows = courseStudents.map(st => {
      const total = getTotal(st.id);
      const pct = calcPct(total, course);
      const g = getGrade(pct);
      return [st.name, st.class_name, ...subjects.map(s => marks[`${st.id}-${s}`] ?? ""), total, pct.toFixed(1) + "%", g.label];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Marks");
    XLSX.writeFile(wb, `GNSI_${course}_Marks_${examDate}.xlsx`);
  };

  const filtered = courseStudents.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()));

  // Mobile: compact controls stacked
  const controlsStyle = isMobile
    ? { display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }
    : { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18, alignItems: "flex-end" };

  const ImportPreview = () => {
    const previewSubjects = importInfo?.subjects || subjects;
    const detCourse = importInfo?.detectedCourse || course;
    return (
      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.10)", padding: isMobile ? 14 : 24, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 600, color: "#1e293b" }}>📂 Import Preview</div>
          <button onClick={() => { setImportMode(false); setImportRows([]); setImportErrors([]); setImportInfo(null); }}
            style={{ ...css.btn, padding: "5px 12px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", fontSize: 12 }}>✕ Cancel</button>
        </div>
        {importInfo && (
          <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12 }}>
            <span style={{ fontWeight: 700, color: "#1D4ED8" }}>🎯 Auto-detected: </span>
            <span style={{ fontWeight: 800, color: "#1a3c2e", background: "#D1FAE5", padding: "2px 10px", borderRadius: 999 }}>{importInfo.detectedCourse}</span>
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 80, background: "#E1F5EE", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#0F6E56", textTransform: "uppercase" }}>Matched</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 600, color: "#0F6E56" }}>{importRows.length}</div>
          </div>
          <div style={{ flex: 1, minWidth: 80, background: importErrors.length ? "#FCEBEB" : "#F9FAFB", border: `1px solid ${importErrors.length ? "#FECACA" : "#E5E7EB"}`, borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: importErrors.length ? "#A32D2D" : "#9CA3AF", textTransform: "uppercase" }}>Unmatched</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 600, color: importErrors.length ? "#A32D2D" : "#9CA3AF" }}>{importErrors.length}</div>
          </div>
        </div>
        <div style={{ overflowX: "auto", marginBottom: 16, maxHeight: 300, overflowY: "auto", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 400 }}>
            <thead style={{ position: "sticky", top: 0 }}>
              <tr style={{ background: "#1a3c2e" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", color: "white", fontWeight: 700 }}>Student</th>
                {previewSubjects.map(s => <th key={s} style={{ padding: "8px 8px", textAlign: "center", color: "white", fontWeight: 700, whiteSpace: "nowrap" }}>{s}</th>)}
                <th style={{ padding: "8px 10px", textAlign: "center", color: "white", fontWeight: 700 }}>Total</th>
                <th style={{ padding: "8px 10px", textAlign: "center", color: "white", fontWeight: 700 }}>%</th>
              </tr>
            </thead>
            <tbody>
              {importRows.map(({ student: st, subMarks }, i) => {
                const total = previewSubjects.reduce((s, sub) => s + (subMarks[sub] ?? 0), 0);
                const pct = calcPct(total, detCourse);
                return (
                  <tr key={st.id} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "7px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>{st.name}</td>
                    {previewSubjects.map(sub => (
                      <td key={sub} style={{ padding: "7px 8px", textAlign: "center", color: subMarks[sub] !== undefined ? "#1e293b" : "#CBD5E1", fontWeight: subMarks[sub] !== undefined ? 600 : 400 }}>
                        {subMarks[sub] !== undefined ? subMarks[sub] : "--"}
                      </td>
                    ))}
                    <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 800 }}>{total}</td>
                    <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 700, color: getGrade(pct).color }}>{pct.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {importDone
          ? <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "12px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>✅ Import complete!</div>
          : <button onClick={confirmImport} disabled={importing || !importRows.length}
              style={{ ...css.btn, background: importing ? "#93C5FD" : "#1a3c2e", color: "white", padding: "10px 24px", fontSize: 14, width: isMobile ? "100%" : "auto" }}>
              {importing ? "⏳ Saving…" : `✅ Confirm Import (${importRows.length} students)`}
            </button>
        }
      </div>
    );
  };

  return (
    <div>
      <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={handleFileUpload} />

      {/* Course picker */}
      <div style={{ ...css.card, background: "#F8FAFC", marginBottom: 14 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setMarks({}); }} />
        {subjects.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", gap: 5, flexWrap: "wrap" }}>
            {subjects.map(s => (
              <span key={s} style={{ fontSize: 11, padding: "3px 10px", background: "#E0F2FE", color: "#0369A1", borderRadius: 999, fontWeight: 600 }}>
                {s} <span style={{ opacity: 0.6 }}>/{getSubjectMax(course, s)}</span>
              </span>
            ))}
            <span style={{ fontSize: 11, padding: "3px 10px", background: "#1a3c2e", color: "white", borderRadius: 999, fontWeight: 700 }}>Total: {courseMax}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={controlsStyle}>
        {isMobile ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4, textTransform: "uppercase" }}>Exam Type</label>
                <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input }}>
                  {examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4, textTransform: "uppercase" }}>Date</label>
                <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} style={css.input} />
              </div>
            </div>
            <input placeholder="🔍 Search student…" value={search} onChange={e => setSearch(e.target.value)} style={css.input} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <SaveBtn onClick={handleSave} saving={saving} saved={saved} label="Save Marks" />
              <button onClick={handleExport} style={{ ...css.btn, background: "#E1F5EE", color: "#0F6E56", border: "1px solid #BBF7D0" }}>📥 Excel</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={downloadTemplate} style={{ ...css.btn, background: "#FAFAF9", color: "#6B7280", border: "1px solid #E5E7EB", fontSize: 12 }}>📋 Template</button>
              {perm?.canImport !== false && <button onClick={() => fileInputRef.current?.click()} style={{ ...css.btn, background: "#7c3aed", color: "white", fontSize: 12 }}>📂 Import</button>}
            </div>
          </>
        ) : (
          <>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
              <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: 180 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Date</label>
              <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} style={{ ...css.input, width: 160 }} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Search Student</label>
              <input placeholder="Name…" value={search} onChange={e => setSearch(e.target.value)} style={css.input} />
            </div>
            <SaveBtn onClick={handleSave} saving={saving} saved={saved} label="Save Marks" />
            <button onClick={handleExport} style={{ ...css.btn, background: "#E1F5EE", color: "#0F6E56", border: "1px solid #BBF7D0" }}>📥 Excel</button>
            <div style={{ width: 1, background: "#E5E7EB", alignSelf: "stretch" }} />
            <button onClick={downloadTemplate} style={{ ...css.btn, background: "#FAFAF9", color: "#6B7280", border: "1px solid #E5E7EB" }}>📋 Template</button>
            {perm?.canImport !== false && <button onClick={() => fileInputRef.current?.click()} style={{ ...css.btn, background: "#7c3aed", color: "white" }}>📂 Import Excel / CSV</button>}
          </>
        )}
      </div>

      {saved && <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "10px 16px", borderRadius: 8, marginBottom: 14, fontSize: 13 }}>✅ Marks saved!</div>}
      {importMode && <ImportPreview />}

      {loading ? <Spinner /> : (
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? 12 : 13, minWidth: isMobile ? 500 : "auto" }}>
            <thead>
              <tr style={{ background: "#1a3c2e" }}>
                <th style={{ padding: isMobile ? "8px 10px" : "10px 14px", textAlign: "left", color: "white", fontWeight: 700, fontSize: isMobile ? 11 : 12, position: "sticky", left: 0, background: "#1a3c2e", zIndex: 2 }}>Student</th>
                {subjects.map(s => (
                  <th key={s} style={{ padding: "10px 6px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 10, whiteSpace: "nowrap" }}>
                    {s}<br /><span style={{ opacity: 0.6, fontWeight: 400, fontSize: 9 }}>/{getSubjectMax(course, s)}</span>
                  </th>
                ))}
                <th style={{ padding: "10px 8px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 11 }}>Total</th>
                <th style={{ padding: "10px 8px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 11 }}>%</th>
                <th style={{ padding: "10px 8px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 11 }}>Grd</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((st, i) => {
                const total = getTotal(st.id);
                const pct = calcPct(total, course);
                const g = getGrade(pct);
                return (
                  <tr key={st.id} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: isMobile ? "6px 10px" : "8px 14px", position: "sticky", left: 0, background: i % 2 ? "#F9FAFB" : "white", zIndex: 1 }}>
                      <div style={{ fontWeight: 600, color: "#1e293b", fontSize: isMobile ? 11 : 13, whiteSpace: "nowrap" }}>{st.name}</div>
                      <div style={{ fontSize: 10, color: "#9CA3AF" }}>{st.class_name} · {st.gcc_no}</div>
                    </td>
                    {subjects.map(sub => (
                      <td key={sub} style={{ padding: "5px 3px", textAlign: "center" }}>
                        <input type="number" min="0" max={getSubjectMax(course, sub)} placeholder="--"
                          value={marks[`${st.id}-${sub}`] ?? ""}
                          onChange={e => handleMark(st.id, sub, e.target.value)}
                          style={{ width: isMobile ? 40 : 52, padding: "4px 2px", borderRadius: 6, border: "1px solid #D1D5DB", textAlign: "center", fontSize: isMobile ? 12 : 13, outline: "none" }} />
                        <button onClick={() => toggleAbsent(st.id, sub)}
                          style={{ display: "block", margin: "2px auto 0", fontSize: 8, padding: "1px 4px", borderRadius: 3, border: "1px solid #FECACA", background: absentSet.has(`${st.id}-${sub}`) ? "#FCA5A5" : "#F9FAFB", color: absentSet.has(`${st.id}-${sub}`) ? "#DC2626" : "#9CA3AF", cursor: "pointer", fontWeight: 700 }}>
                          {absentSet.has(`${st.id}-${sub}`) ? "ABS" : "A"}
                        </button>
                      </td>
                    ))}
                    <td style={{ padding: "6px 6px", textAlign: "center", fontWeight: 800, fontSize: isMobile ? 12 : 13 }}>{total}</td>
                    <td style={{ padding: "6px 6px", textAlign: "center", color: g.color, fontWeight: 700, fontSize: isMobile ? 11 : 13 }}>{pct.toFixed(0)}%</td>
                    <td style={{ padding: "6px 6px", textAlign: "center" }}><Badge label={g.label} color={g.color} bg={g.bg} /></td>
                  </tr>
                );
              })}
              {!filtered.length && (
                <tr><td colSpan={subjects.length + 4} style={{ padding: 32, textAlign: "center", color: "#94A3B8" }}>No students found for <b>{course}</b>.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── MARKS GRID (mobile: scrollable table) ────────────────────────────────────
function MarksGrid({ courseSubjects, examTypes, students }) {
  const isMobile = useMobile();
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const subjects = courseSubjects[course] || [];
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course || (s.course || "").toUpperCase() === course
  );
  const courseMax = getCourseMax(course);
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState("");
  const [marks, setMarks] = useState({});
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]);
    });
  }, [examType]);

  useEffect(() => {
    if (!examType || !examDate) return;
    setLoading(true);
    const ids = courseStudents.map(s => s.id);
    supabase.from("exam_marks").select("*").eq("exam_type_id", examType).eq("exam_date", examDate).in("student_id", ids.length ? ids : ["__none__"]).then(({ data }) => {
      const map = {}; (data || []).forEach(r => { map[`${r.student_id}-${r.subject}`] = r.marks; });
      setMarks(map); setLoading(false);
    });
  }, [examType, examDate, course]);

  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);

  return (
    <div>
      <div style={{ ...css.card, background: "#F8FAFC", marginBottom: 14 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setMarks({}); }} />
      </div>
      <div style={{ display: "flex", gap: isMobile ? 8 : 12, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 180 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select>
        </div>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Date</label>
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 160 }}>{dates.map(d => <option key={d} value={d}>{d}</option>)}</select>
        </div>
      </div>
      {loading ? <Spinner /> : (
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: isMobile ? 480 : "auto" }}>
            <thead><tr style={{ background: "#1a3c2e" }}>
              <th style={{ padding: "10px 14px", textAlign: "left", color: "white", fontWeight: 700, fontSize: 12, position: isMobile ? "sticky" : "static", left: 0, background: "#1a3c2e", zIndex: 2 }}>Student</th>
              {subjects.map(s => (
                <th key={s} style={{ padding: "10px 6px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 10, whiteSpace: "nowrap" }}>
                  {s}<br /><span style={{ opacity: 0.6, fontWeight: 400, fontSize: 9 }}>/{getSubjectMax(course, s)}</span>
                </th>
              ))}
              <th style={{ padding: "10px 8px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 11 }}>Total</th>
              <th style={{ padding: "10px 8px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 11 }}>%</th>
              <th style={{ padding: "10px 8px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 11 }}>Grd</th>
            </tr></thead>
            <tbody>
              {courseStudents.map((st, i) => {
                const total = getTotal(st.id);
                const pct = calcPct(total, course);
                const g = getGrade(pct);
                return (
                  <tr key={st.id} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "8px 14px", fontWeight: 600, color: "#1e293b", position: isMobile ? "sticky" : "static", left: 0, background: i % 2 ? "#F9FAFB" : "white", zIndex: 1 }}>
                      {st.name}<div style={{ fontSize: 10, color: "#9CA3AF" }}>GCC {st.gcc_no}</div>
                    </td>
                    {subjects.map(sub => <td key={sub} style={{ padding: "8px 6px", textAlign: "center", fontSize: 12 }}>{marks[`${st.id}-${sub}`] ?? <span style={{ color: "#CBD5E1" }}>--</span>}</td>)}
                    <td style={{ padding: "8px 8px", textAlign: "center", fontWeight: 800 }}>{total}</td>
                    <td style={{ padding: "8px 8px", textAlign: "center", color: g.color, fontWeight: 700 }}>{pct.toFixed(0)}%</td>
                    <td style={{ padding: "8px 8px", textAlign: "center" }}><Badge label={g.label} color={g.color} bg={g.bg} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── ANALYTICS (mobile: charts stack, stat cards 2-col) ──────────────────────
function Analytics({ courseSubjects, examTypes, students }) {
  const isMobile = useMobile();
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const subjects = courseSubjects[course] || [];
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course || (s.course || "").toUpperCase() === course
  );
  const courseMax = getCourseMax(course);
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState("");
  const [marks, setMarks] = useState({});
  const [dates, setDates] = useState([]);
  const gradeRef = useRef(null); const subjectRef = useRef(null); const passRef = useRef(null);
  const chartsRef = useRef([]);

  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]);
    });
  }, [examType]);

  useEffect(() => {
    if (!examType || !examDate) return;
    const ids = courseStudents.map(s => s.id);
    supabase.from("exam_marks").select("*").eq("exam_type_id", examType).eq("exam_date", examDate).in("student_id", ids.length ? ids : ["__none__"]).then(({ data }) => {
      const map = {}; (data || []).forEach(r => { map[`${r.student_id}-${r.subject}`] = r.marks; }); setMarks(map);
    });
  }, [examType, examDate, course]);

  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);
  const n = courseStudents.length || 1;

  const gradeCounts = {}; GRADE_PRESETS.forEach(g => { gradeCounts[g.label] = 0; });
  const subjectAvgPct = {}; const subjectPass = {};
  subjects.forEach(s => { subjectAvgPct[s] = 0; subjectPass[s] = 0; });

  courseStudents.forEach(st => {
    const pct = calcPct(getTotal(st.id), course);
    const g = getGrade(pct); gradeCounts[g.label] = (gradeCounts[g.label] || 0) + 1;
    subjects.forEach(sub => {
      const m = Number(marks[`${st.id}-${sub}`]) || 0;
      const subMax = getSubjectMax(course, sub);
      subjectAvgPct[sub] += (m / subMax) * 100;
      if ((m / subMax) * 100 >= 40) subjectPass[sub]++;
    });
  });
  subjects.forEach(s => { subjectAvgPct[s] = Math.round(subjectAvgPct[s] / n * 10) / 10; });

  const passed = courseStudents.filter(st => calcPct(getTotal(st.id), course) >= 40).length;
  const classAvg = (courseStudents.reduce((s, st) => s + calcPct(getTotal(st.id), course), 0) / n).toFixed(1);
  const highest = courseStudents.length ? Math.max(...courseStudents.map(st => getTotal(st.id))) : 0;
  const lowest  = courseStudents.length ? Math.min(...courseStudents.map(st => getTotal(st.id))) : 0;

  useEffect(() => {
    ensureLibs().then(() => {
      const Chart = window.Chart; if (!Chart) return;
      chartsRef.current = (chartsRef.current || []).filter(Boolean);
      chartsRef.current.forEach(c => { try { if (c && typeof c.destroy === "function") c.destroy(); } catch (_) {} });
      chartsRef.current = [];
      if (gradeRef.current) {
        const labels = GRADE_PRESETS.map(g => g.label);
        chartsRef.current.push(new Chart(gradeRef.current, { type: "doughnut", data: { labels, datasets: [{ data: labels.map(l => gradeCounts[l] || 0), backgroundColor: GRADE_PRESETS.map(g => g.color), borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } } }));
      }
      if (subjectRef.current) {
        chartsRef.current.push(new Chart(subjectRef.current, { type: "bar", data: { labels: subjects, datasets: [{ label: "Avg %", data: subjects.map(s => subjectAvgPct[s]), backgroundColor: "#2A5C45", borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } } }));
      }
      if (passRef.current) {
        chartsRef.current.push(new Chart(passRef.current, { type: "bar", data: { labels: subjects, datasets: [{ label: "Pass Rate %", data: subjects.map(s => Math.round((subjectPass[s] / n) * 100)), backgroundColor: "#185FA5", borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } } }));
      }
    });
    return () => { chartsRef.current.forEach(c => { try { c.destroy(); } catch (_) {} }); chartsRef.current = []; };
  }, [marks, course]);

  const chartH = isMobile ? 220 : 260;

  return (
    <div>
      <div style={{ ...css.card, background: "#F8FAFC", marginBottom: 14 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setMarks({}); }} />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 180 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select>
        </div>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Date</label>
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 160 }}>{dates.map(d => <option key={d} value={d}>{d}</option>)}</select>
        </div>
      </div>

      {/* Stat cards — 2-col on mobile */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill,minmax(180px,1fr))", gap: isMobile ? 10 : 14, marginBottom: 20 }}>
        <DashStatCard label={`${course} Students`} value={courseStudents.length} strip="blue" color="#185FA5" />
        <DashStatCard label="Class Average" value={`${classAvg}%`} strip="teal" color="#0891b2" />
        <DashStatCard label="Pass Rate" value={`${Math.round(passed / n * 100)}%`} sub={`${passed} passed`} strip="green" color="#0F6E56" />
        <DashStatCard label="Highest" value={`${highest}/${courseMax}`} strip="gold" color="#B8860B" />
        <DashStatCard label="Lowest" value={`${lowest}/${courseMax}`} strip="red" color="#A32D2D" />
      </div>

      {/* Charts — side-by-side on desktop, stacked on mobile */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={css.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", fontFamily: "'Playfair Display',serif" }}>Grade Distribution</div>
            <button onClick={() => { if (!gradeRef.current) return; const a = document.createElement("a"); a.download = `grade-${course}.png`; a.href = gradeRef.current.toDataURL("image/png"); a.click(); }}
              style={{ ...css.btn, padding: "4px 10px", background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB", fontSize: 11 }}>⬇ PNG</button>
          </div>
          <div style={{ height: chartH }}><canvas ref={gradeRef} /></div>
        </div>
        <div style={css.card}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 12, fontFamily: "'Playfair Display',serif" }}>Subject-wise Average %</div>
          <div style={{ height: chartH }}><canvas ref={subjectRef} /></div>
        </div>
      </div>
      <div style={css.card}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 12, fontFamily: "'Playfair Display',serif" }}>Subject-wise Pass Rate</div>
        <div style={{ height: chartH }}><canvas ref={passRef} /></div>
      </div>
    </div>
  );
}

// ─── RANKINGS (mobile: podium stacked, table scrollable) ─────────────────────
function Rankings({ courseSubjects, examTypes, students }) {
  const isMobile = useMobile();
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const subjects = courseSubjects[course] || [];
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course || (s.course || "").toUpperCase() === course
  );
  const courseMax = getCourseMax(course);
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState("");
  const [marks, setMarks] = useState({});
  const [dates, setDates] = useState([]);

  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]);
    });
  }, [examType]);

  useEffect(() => {
    if (!examType || !examDate) return;
    const ids = courseStudents.map(s => s.id);
    supabase.from("exam_marks").select("*").eq("exam_type_id", examType).eq("exam_date", examDate).in("student_id", ids.length ? ids : ["__none__"]).then(({ data }) => {
      const map = {}; (data || []).forEach(r => { map[`${r.student_id}-${r.subject}`] = r.marks; }); setMarks(map);
    });
  }, [examType, examDate, course]);

  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);
  const ranked = [...courseStudents].map(st => ({ ...st, total: getTotal(st.id), pct: calcPct(getTotal(st.id), course) })).sort((a, b) => b.total - a.total);
  let cr = 1, pt = null;
  const rankedWithRanks = ranked.map((st, i) => { if (i === 0) { cr = 1; pt = st.total; } else if (st.total !== pt) { cr++; pt = st.total; } return { ...st, rank: cr }; });
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div>
      <div style={{ ...css.card, background: "#F8FAFC", marginBottom: 14 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setMarks({}); }} />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 180 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select>
        </div>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Date</label>
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 160 }}>{dates.map(d => <option key={d} value={d}>{d}</option>)}</select>
        </div>
      </div>

      {/* Podium — 1 col on mobile, 3 col on desktop */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(3,1fr)", gap: isMobile ? 10 : 14, marginBottom: 20 }}>
        {rankedWithRanks.slice(0, 3).map((st, i) => {
          const g = getGrade(st.pct);
          const podiumColor = i === 0 ? "#B8860B" : i === 1 ? "#94A3B8" : "#CD7F32";
          return (
            <div key={st.id} style={{ ...css.card, textAlign: "center", borderTop: `4px solid ${podiumColor}`, position: "relative", padding: isMobile ? "14px 12px" : 20 }}>
              <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", width: 24, height: 24, borderRadius: "50%", background: podiumColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "white" }}>{i + 1}</div>
              <div style={{ fontSize: isMobile ? 28 : 32, marginTop: 10, marginBottom: 4 }}>{medals[i]}</div>
              <div style={{ fontWeight: 800, fontSize: isMobile ? 13 : 15 }}>{st.name}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF", marginBottom: 6 }}>GCC {st.gcc_no}</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: isMobile ? 22 : 28, fontWeight: 600, color: g.color }}>{st.total}<span style={{ fontSize: 12, color: "#9CA3AF" }}>/{courseMax}</span></div>
              <div style={{ fontSize: 13, color: g.color, fontWeight: 700, marginBottom: 6 }}>{st.pct.toFixed(1)}%</div>
              <div><Badge label={g.label} color={g.color} bg={g.bg} /></div>
            </div>
          );
        })}
      </div>

      {/* Full rankings table — scrollable on mobile */}
      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>🏆 Full Rankings — {course}</div>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: isMobile ? 380 : "auto" }}>
            <thead><tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
              {["Rank", "Student", "GCC", "Total", "%", "Grade"].map(h => <th key={h} style={{ padding: "10px 10px", textAlign: h === "Student" ? "left" : "center", fontWeight: 700, color: "#374151", fontSize: 11 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rankedWithRanks.map((st, i) => {
                const g = getGrade(st.pct);
                return (
                  <tr key={st.id} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "9px 10px", textAlign: "center", fontWeight: 800, color: st.rank <= 3 ? "#D97706" : "#9CA3AF", fontSize: st.rank <= 3 ? 15 : 12 }}>{st.rank <= 3 ? medals[st.rank - 1] : `#${st.rank}`}</td>
                    <td style={{ padding: "9px 10px", fontWeight: 600, fontSize: isMobile ? 12 : 13 }}>{st.name}</td>
                    <td style={{ padding: "9px 10px", textAlign: "center", color: "#64748b", fontSize: 12 }}>{st.gcc_no || "—"}</td>
                    <td style={{ padding: "9px 10px", textAlign: "center", fontWeight: 800 }}>{st.total}<span style={{ fontSize: 10, color: "#9CA3AF" }}>/{courseMax}</span></td>
                    <td style={{ padding: "9px 10px", textAlign: "center", color: g.color, fontWeight: 700 }}>{st.pct.toFixed(1)}%</td>
                    <td style={{ padding: "9px 10px", textAlign: "center" }}><Badge label={g.label} color={g.color} bg={g.bg} /></td>
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

// ─── PROGRESS TAB (mobile: stacked panels) ────────────────────────────────────
function ProgressTab({ courseSubjects, examTypes, students }) {
  const isMobile = useMobile();
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const subjects = courseSubjects[course] || [];
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course || (s.course || "").toUpperCase() === course
  );
  const courseMax = getCourseMax(course);
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [search, setSearch] = useState("");
  const [allMarks, setAllMarks] = useState([]);
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(false);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);

  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort();
      setDates(unique);
    });
  }, [examType]);

  useEffect(() => {
    if (!selectedStudent || !examType || !dates.length) return;
    setLoading(true);
    supabase.from("exam_marks").select("*").eq("student_id", selectedStudent.id).eq("exam_type_id", examType).then(({ data }) => {
      setAllMarks(data || []); setLoading(false);
    });
  }, [selectedStudent, examType, dates]);

  useEffect(() => {
    if (!chartRef.current || !selectedStudent || !dates.length) return;
    ensureLibs().then(() => {
      const Chart = window.Chart; if (!Chart) return;
      if (chartInstance.current) { try { chartInstance.current.destroy(); } catch (_) {} }
      const colors = ["#2A5C45","#185FA5","#7c3aed","#d97706","#0891b2","#e11d48","#84cc16"];
      const datasets = subjects.map((sub, i) => ({
        label: sub,
        data: dates.map(d => { const m = allMarks.find(r => r.subject === sub && r.exam_date === d); return m ? m.marks : null; }),
        borderColor: colors[i % colors.length], backgroundColor: colors[i % colors.length] + "22",
        tension: 0.4, fill: false, pointRadius: 4, pointHoverRadius: 6, spanGaps: true,
      }));
      const totalsData = dates.map(d => {
        const dm = allMarks.filter(r => r.exam_date === d);
        return dm.length ? dm.reduce((s, r) => s + (r.marks || 0), 0) : null;
      });
      datasets.push({ label: "Total", data: totalsData, borderColor: "#1a3c2e", backgroundColor: "#1a3c2e22", tension: 0.4, fill: true, borderWidth: 3, pointRadius: 5, pointHoverRadius: 7, spanGaps: true, yAxisID: "y2" });
      chartInstance.current = new Chart(chartRef.current, {
        type: "line", data: { labels: dates, datasets },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
          plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } },
          scales: { x: { grid: { color: "#F1F5F9" } }, y: { beginAtZero: true, grid: { color: "#F1F5F9" }, title: { display: !isMobile, text: "Subject Marks" } }, y2: { beginAtZero: true, position: "right", max: courseMax, grid: { display: false }, title: { display: !isMobile, text: `Total /${courseMax}` } } } },
      });
    });
    return () => { if (chartInstance.current) { try { chartInstance.current.destroy(); } catch (_) {} } };
  }, [allMarks, dates, selectedStudent]);

  const filteredStudents = courseStudents.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()) || String(s.gcc_no).includes(search));
  const dateSummary = dates.map(d => {
    const dm = allMarks.filter(r => r.exam_date === d);
    const total = dm.reduce((s, r) => s + (r.marks || 0), 0);
    const pct = dm.length ? calcPct(total, course) : null;
    return { date: d, total, pct, grade: pct !== null ? getGrade(pct) : null };
  });

  return (
    <div>
      <div style={{ ...css.card, background: "#F8FAFC", marginBottom: 14 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setSelectedStudent(null); setAllMarks([]); }} />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => { setExamType(e.target.value); setAllMarks([]); }} style={{ ...css.input, width: isMobile ? "100%" : 200 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select>
        </div>
      </div>

      {/* Layout: stacked on mobile, side-by-side on desktop */}
      <div style={{ display: isMobile ? "flex" : "grid", flexDirection: "column", gridTemplateColumns: "280px 1fr", gap: isMobile ? 14 : 20 }}>
        {/* Student selector */}
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>👤 Select Student</div>
          <div style={{ padding: 10 }}><input placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...css.input, marginBottom: 8, fontSize: 12 }} /></div>
          <div style={{ maxHeight: isMobile ? 200 : 480, overflowY: "auto" }}>
            {filteredStudents.map(st => (
              <div key={st.id} onClick={() => setSelectedStudent(st)}
                style={{ padding: "9px 16px", cursor: "pointer", borderBottom: "1px solid #F1F5F9", background: selectedStudent?.id === st.id ? "#E1F5EE" : "white" }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: selectedStudent?.id === st.id ? "#0F6E56" : "#1e293b" }}>{st.name}</div>
                <div style={{ fontSize: 10, color: "#9CA3AF" }}>GCC {st.gcc_no} · {st.class_name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div>
          {!selectedStudent ? (
            <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", padding: isMobile ? 32 : 60, textAlign: "center", color: "#94A3B8" }}>
              <div style={{ fontSize: isMobile ? 36 : 48, marginBottom: 12 }}>📈</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Select a student to view their progress</div>
            </div>
          ) : loading ? <Spinner /> : (
            <>
              <div style={{ background: "linear-gradient(135deg,#1a3c2e,#2A5C45)", borderRadius: 12, padding: isMobile ? "14px 16px" : "18px 24px", marginBottom: 14, color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: isMobile ? 16 : 20 }}>{selectedStudent.name}</div>
                  <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>GCC {selectedStudent.gcc_no} · {selectedStudent.class_name}</div>
                </div>
                {dateSummary.filter(d => d.pct !== null).slice(-1).map(d => (
                  <div key={d.date} style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 600 }}>{d.pct?.toFixed(1)}%</div>
                    <div style={{ fontSize: 10, opacity: 0.7, textTransform: "uppercase" }}>Latest</div>
                  </div>
                ))}
              </div>
              {dates.length > 0 ? (
                <div style={{ ...css.card, marginBottom: 14 }}>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 14, marginBottom: 12 }}>📈 Performance Trend</div>
                  <div style={{ height: isMobile ? 220 : 320 }}><canvas ref={chartRef} /></div>
                </div>
              ) : <div style={{ ...css.card, textAlign: "center", color: "#94A3B8", padding: 40 }}>No exam data found.</div>}

              {dateSummary.some(d => d.pct !== null) && (
                <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                  <div style={{ padding: "12px 18px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>📋 Exam-wise Summary</div>
                  <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: isMobile ? 400 : "auto" }}>
                      <thead><tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
                        <th style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700, color: "#374151", fontSize: 11 }}>Date</th>
                        {subjects.map(s => <th key={s} style={{ padding: "9px 6px", textAlign: "center", fontWeight: 700, color: "#374151", fontSize: 10, whiteSpace: "nowrap" }}>{s}</th>)}
                        <th style={{ padding: "9px 10px", textAlign: "center", fontWeight: 700, color: "#374151", fontSize: 11 }}>Total</th>
                        <th style={{ padding: "9px 10px", textAlign: "center", fontWeight: 700, color: "#374151", fontSize: 11 }}>%</th>
                        <th style={{ padding: "9px 10px", textAlign: "center", fontWeight: 700, color: "#374151", fontSize: 11 }}>Grd</th>
                      </tr></thead>
                      <tbody>
                        {dateSummary.map((d, i) => (
                          <tr key={d.date} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                            <td style={{ padding: "8px 12px", fontWeight: 600, fontSize: 12 }}>{d.date}</td>
                            {subjects.map(sub => { const m = allMarks.find(r => r.subject === sub && r.exam_date === d.date); return <td key={sub} style={{ padding: "8px 6px", textAlign: "center", color: m ? "#1e293b" : "#CBD5E1", fontSize: 12 }}>{m ? m.marks : "--"}</td>; })}
                            <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800 }}>{d.pct !== null ? `${d.total}/${courseMax}` : "--"}</td>
                            <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: d.grade?.color || "#94A3B8" }}>{d.pct !== null ? `${d.pct.toFixed(1)}%` : "--"}</td>
                            <td style={{ padding: "8px 10px", textAlign: "center" }}>{d.grade ? <Badge label={d.grade.label} color={d.grade.color} bg={d.grade.bg} /> : "--"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── COMPARE TAB (mobile: stacked, 2-col compare cards) ──────────────────────
function CompareTab({ courseSubjects, examTypes, students }) {
  const isMobile = useMobile();
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const subjects = courseSubjects[course] || [];
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course || (s.course || "").toUpperCase() === course
  );
  const courseMax = getCourseMax(course);
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState("");
  const [dates, setDates] = useState([]);
  const [marks, setMarks] = useState({});
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const COMPARE_COLORS = ["#2A5C45","#185FA5","#7c3aed","#d97706"];

  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]);
    });
  }, [examType]);

  useEffect(() => {
    if (!examType || !examDate) return;
    const ids = courseStudents.map(s => s.id);
    supabase.from("exam_marks").select("*").eq("exam_type_id", examType).eq("exam_date", examDate).in("student_id", ids.length ? ids : ["__none__"]).then(({ data }) => {
      const map = {}; (data || []).forEach(r => { map[`${r.student_id}-${r.subject}`] = r.marks; }); setMarks(map);
    });
  }, [examType, examDate, course]);

  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);
  const toggleStudent = st => {
    if (selected.find(s => s.id === st.id)) setSelected(p => p.filter(s => s.id !== st.id));
    else if (selected.length < 4) setSelected(p => [...p, st]);
  };

  useEffect(() => {
    if (!chartRef.current || selected.length < 2) return;
    ensureLibs().then(() => {
      const Chart = window.Chart; if (!Chart) return;
      if (chartInstance.current) { try { chartInstance.current.destroy(); } catch (_) {} }
      chartInstance.current = new Chart(chartRef.current, {
        type: "radar",
        data: { labels: subjects, datasets: selected.map((st, i) => ({ label: st.name.split(" ")[0], data: subjects.map(sub => Number(marks[`${st.id}-${sub}`]) || 0), borderColor: COMPARE_COLORS[i], backgroundColor: COMPARE_COLORS[i] + "33", borderWidth: 2, pointRadius: 4 })) },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } }, scales: { r: { beginAtZero: true } } },
      });
    });
    return () => { if (chartInstance.current) { try { chartInstance.current.destroy(); } catch (_) {} } };
  }, [selected, marks]);

  const filteredStudents = courseStudents.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()) || String(s.gcc_no).includes(search));

  // On mobile, determine compare cards columns
  const compareCols = isMobile
    ? (selected.length <= 2 ? "1fr 1fr" : "1fr 1fr")
    : `repeat(${selected.length}, 1fr)`;

  return (
    <div>
      <div style={{ ...css.card, background: "#F8FAFC", marginBottom: 14 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setSelected([]); setMarks({}); }} />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 200 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select>
        </div>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Date</label>
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 160 }}>{dates.map(d => <option key={d} value={d}>{d}</option>)}</select>
        </div>
        {!isMobile && <div style={{ fontSize: 12, color: "#9CA3AF", alignSelf: "center" }}>Select 2–4 students</div>}
      </div>

      {isMobile && selected.length === 0 && (
        <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 10, textAlign: "center" }}>Tap students below to select 2–4 for comparison</div>
      )}

      {/* Layout: stacked on mobile */}
      <div style={{ display: isMobile ? "flex" : "grid", flexDirection: "column", gridTemplateColumns: "260px 1fr", gap: isMobile ? 12 : 20 }}>
        {/* Student list */}
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>Select Students ({selected.length}/4)</div>
          <div style={{ padding: 10 }}><input placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...css.input, marginBottom: 8, fontSize: 12 }} /></div>
          <div style={{ maxHeight: isMobile ? 200 : 420, overflowY: "auto" }}>
            {filteredStudents.map(st => {
              const idx = selected.findIndex(s => s.id === st.id); const isSel = idx !== -1;
              return (
                <div key={st.id} onClick={() => toggleStudent(st)}
                  style={{ padding: "8px 14px", cursor: "pointer", borderBottom: "1px solid #F1F5F9", background: isSel ? COMPARE_COLORS[idx] + "18" : "white", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: isSel ? COMPARE_COLORS[idx] : "#E5E7EB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: isSel ? "white" : "#9CA3AF", flexShrink: 0 }}>{isSel ? idx + 1 : ""}</div>
                  <div><div style={{ fontWeight: 600, fontSize: 12, color: isSel ? COMPARE_COLORS[idx] : "#1e293b" }}>{st.name}</div><div style={{ fontSize: 10, color: "#9CA3AF" }}>GCC {st.gcc_no}</div></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comparison panel */}
        <div>
          {selected.length < 2 ? (
            <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", padding: isMobile ? 32 : 60, textAlign: "center", color: "#94A3B8" }}>
              <div style={{ fontSize: isMobile ? 36 : 48, marginBottom: 12 }}>⚖️</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Select at least 2 students</div>
            </div>
          ) : (
            <>
              {/* Compare cards */}
              <div style={{ display: "grid", gridTemplateColumns: compareCols, gap: isMobile ? 8 : 12, marginBottom: 14 }}>
                {selected.map((st, i) => {
                  const total = getTotal(st.id); const pct = calcPct(total, course); const g = getGrade(pct);
                  return (
                    <div key={st.id} style={{ background: "white", borderRadius: 10, padding: isMobile ? "12px 10px" : "16px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.07)", borderTop: `4px solid ${COMPARE_COLORS[i]}`, position: "relative" }}>
                      <div style={{ position: "absolute", top: 8, right: 10, width: 20, height: 20, borderRadius: "50%", background: COMPARE_COLORS[i], display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "white" }}>{i + 1}</div>
                      <div style={{ fontWeight: 700, fontSize: isMobile ? 11 : 13, color: "#1e293b", marginBottom: 2, paddingRight: 24, lineHeight: 1.3 }}>{st.name}</div>
                      <div style={{ fontSize: 10, color: "#9CA3AF", marginBottom: 8 }}>GCC {st.gcc_no}</div>
                      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: isMobile ? 22 : 28, fontWeight: 600, color: COMPARE_COLORS[i] }}>{pct.toFixed(1)}%</div>
                      <div style={{ fontSize: 11, color: "#64748b" }}>{total}/{courseMax}</div>
                      <div style={{ marginTop: 6 }}><Badge label={g.label} color={g.color} bg={g.bg} /></div>
                    </div>
                  );
                })}
              </div>

              {/* Radar chart */}
              <div style={{ ...css.card, marginBottom: 14 }}>
                <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 14, marginBottom: 12 }}>🕸️ Subject Radar</div>
                <div style={{ height: isMobile ? 220 : 320 }}><canvas ref={chartRef} /></div>
              </div>

              {/* Breakdown table */}
              <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <div style={{ padding: "12px 18px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>📊 Subject Breakdown</div>
                <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? 12 : 13, minWidth: isMobile ? 340 : "auto" }}>
                    <thead><tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
                      <th style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700, color: "#374151", fontSize: 11 }}>Subject</th>
                      <th style={{ padding: "9px 8px", textAlign: "center", fontWeight: 700, color: "#374151", fontSize: 10 }}>Max</th>
                      {selected.map((st, i) => <th key={st.id} style={{ padding: "9px 10px", textAlign: "center", fontWeight: 700, color: COMPARE_COLORS[i], fontSize: isMobile ? 10 : 12 }}>{st.name.split(" ")[0]}</th>)}
                    </tr></thead>
                    <tbody>
                      {subjects.map((sub, ri) => {
                        const subMarks = selected.map(st => Number(marks[`${st.id}-${sub}`]) || 0);
                        const maxMark = Math.max(...subMarks);
                        return (
                          <tr key={sub} style={{ background: ri % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                            <td style={{ padding: "8px 12px", fontWeight: 600, fontSize: isMobile ? 11 : 13 }}>{sub}</td>
                            <td style={{ padding: "8px 8px", textAlign: "center", color: "#94A3B8", fontSize: 11 }}>{getSubjectMax(course, sub)}</td>
                            {selected.map((st, i) => { const m = Number(marks[`${st.id}-${sub}`]) || 0; const isTop = m === maxMark && m > 0;
                              return <td key={st.id} style={{ padding: "8px 10px", textAlign: "center", fontWeight: isTop ? 800 : 500, color: isTop ? COMPARE_COLORS[i] : "#374151" }}>{m}{isTop ? " 🏆" : ""}</td>; })}
                          </tr>
                        );
                      })}
                      <tr style={{ background: "#F0FDF4", borderTop: "2px solid #BBF7D0" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 800, color: "#1a3c2e", fontSize: isMobile ? 12 : 13 }}>TOTAL</td>
                        <td style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#94A3B8" }}>{courseMax}</td>
                        {selected.map((st, i) => { const total = getTotal(st.id); const pct = calcPct(total, course); const maxTotal = Math.max(...selected.map(s => getTotal(s.id))); const isTop = total === maxTotal;
                          return <td key={st.id} style={{ padding: "10px 10px", textAlign: "center", fontWeight: 800, color: isTop ? COMPARE_COLORS[i] : "#374151", fontSize: isMobile ? 11 : 13 }}>{total} <span style={{ fontSize: 10, color: "#64748b" }}>({pct.toFixed(0)}%)</span>{isTop ? " 🏆" : ""}</td>; })}
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── EXAM TYPES MANAGER (mobile: stacked) ─────────────────────────────────────
function ExamTypesManager({ examTypes, onUpdate }) {
  const isMobile = useMobile();
  const [list, setList] = useState(examTypes);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false);

  const add = async () => {
    if (!form.name.trim()) return; setSaving(true);
    const { data } = await supabase.from("exam_types").insert([{ name: form.name.trim(), description: form.description }]).select();
    if (data) { const updated = [...list, data[0]]; setList(updated); onUpdate(updated); }
    setForm({ name: "", description: "" }); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };
  const remove = async id => {
    if (!confirm("Delete this exam type?")) return;
    await supabase.from("exam_types").delete().eq("id", id);
    const updated = list.filter(e => e.id !== id); setList(updated); onUpdate(updated);
  };

  return (
    <div style={{ display: isMobile ? "flex" : "grid", flexDirection: "column", gridTemplateColumns: "320px 1fr", gap: isMobile ? 14 : 20 }}>
      <div style={css.card}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 14 }}>➕ Add Exam Type</div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Name *</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. 1st Monthly Test" style={css.input} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Description</label>
          <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional" style={css.input} />
        </div>
        <SaveBtn onClick={add} saving={saving} saved={saved} label="Add Type" />
      </div>
      <div style={css.card}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 14 }}>⚙️ Configured Exam Types</div>
        {list.map(et => (
          <div key={et.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 8, marginBottom: 8, background: "#F9FAFB" }}>
            <div><div style={{ fontWeight: 600, fontSize: 13 }}>{et.name}</div>{et.description && <div style={{ fontSize: 11, color: "#9CA3AF" }}>{et.description}</div>}</div>
            <button onClick={() => remove(et.id)} style={{ ...css.btn, padding: "4px 10px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", fontSize: 12 }}>✕</button>
          </div>
        ))}
        {!list.length && <div style={{ color: "#94A3B8", fontSize: 13, textAlign: "center", padding: 20 }}>No exam types yet.</div>}
      </div>
    </div>
  );
}

// ─── BULK REPORTS (mobile: stacked, 2-col stat pills) ────────────────────────
// NOTE: Only the layout wrapper changes — all internal logic is identical to original.
// Replace the two-panel grid divs in BulkReports with these responsive versions:

// Inside BulkReports, replace:
//   <div style={{ display:"grid", gridTemplateColumns:"300px 1fr", gap:20 }}>
// with the isMobile-aware version below. Apply to BOTH the reportcard and admitcard sections.

// ─── REPORT CARD SETTINGS PANEL wrapper (drop-in for BulkReports) ────────────

// ─── STUDENTS TAB ─────────────────────────────────────────────────────────────
function StudentsTab({ courseSubjects, students, onStudentsChange, currentUser, perms }) {
  const isMobile = useMobile();
  const perm = usePerm(currentUser, perms)
  const courses = Object.keys(courseSubjects);

  const EMPTY_FORM = { name: "", gcc_no: "", admission_no: "", course: courses[0] || "", class_name: "" };
  const [form, setForm]             = useState(EMPTY_FORM);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [error, setError]           = useState("");
  const [search, setSearch]         = useState("");
  const [filterCourse, setFilterCourse] = useState("ALL");
  const [editId, setEditId]         = useState(null);
  const [editForm, setEditForm]     = useState({});
  const [editSaving, setEditSaving] = useState(false);
  const [deleteId, setDeleteId]     = useState(null);
  const [view, setView]             = useState("list");

  const batchesForCourse = (crs) => {
    const set = new Set(
      students.filter(s => (s.course || "").toUpperCase() === crs).map(s => s.class_name).filter(Boolean)
    );
    return [...set].sort();
  };

  const handleAdd = async () => {
    setError("");
    if (!form.name.trim())       { setError("Student name is required."); return; }
    if (!form.gcc_no.trim())     { setError("GCC No. is required."); return; }
    if (!form.course)            { setError("Course is required."); return; }
    if (!form.class_name.trim()) { setError("Batch is required."); return; }
    if (students.find(s => String(s.gcc_no) === String(form.gcc_no).trim())) {
      setError(`GCC No. ${form.gcc_no} already exists.`); return;
    }
    setSaving(true);
    const batchVal = form.class_name.trim().toUpperCase();
    const payload = {
      name: form.name.trim().toUpperCase(), gcc_no: Number(form.gcc_no),
      admission_no: form.admission_no.trim() || null,
      course: form.course.toUpperCase(), class_name: batchVal, batch: batchVal,
    };
    const { data, error: sbErr } = await supabase.from("students").insert([payload]).select();
    if (sbErr) { setError(sbErr.message); setSaving(false); return; }
    onStudentsChange([...students, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
    setForm(EMPTY_FORM); setSaving(false); setSaved(true);
    setTimeout(() => { setSaved(false); setView("list"); }, 1800);
  };

  const startEdit = (st) => {
    setEditId(st.id);
    setEditForm({ name: st.name, gcc_no: st.gcc_no, admission_no: st.admission_no || "", course: st.course || "", class_name: st.class_name || "" });
  };
  const cancelEdit = () => { setEditId(null); setEditForm({}); };
  const saveEdit = async (id) => {
    setEditSaving(true);
    const batchVal = (editForm.class_name || "").trim().toUpperCase();
    const payload = {
      name: editForm.name.trim().toUpperCase(), gcc_no: Number(editForm.gcc_no),
      admission_no: editForm.admission_no || null,
      course: (editForm.course || "").toUpperCase(), class_name: batchVal, batch: batchVal,
    };
    const { error: sbErr } = await supabase.from("students").update(payload).eq("id", id);
    if (sbErr) { alert(sbErr.message); setEditSaving(false); return; }
    onStudentsChange(students.map(s => s.id === id ? { ...s, ...payload } : s));
    setEditId(null); setEditSaving(false);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await supabase.from("students").delete().eq("id", deleteId);
    onStudentsChange(students.filter(s => s.id !== deleteId));
    setDeleteId(null);
  };

  const filtered = students.filter(s => {
    const matchSearch = !search || s.name?.toLowerCase().includes(search.toLowerCase()) || String(s.gcc_no).includes(search);
    const matchCourse = filterCourse === "ALL" || (s.course || "").toUpperCase() === filterCourse || (s.class_name || "").toUpperCase() === filterCourse;
    return matchSearch && matchCourse;
  });

  const statsPerCourse = courses.map(c => ({
    course: c, count: students.filter(s => (s.course || "").toUpperCase() === c).length, batches: batchesForCourse(c),
  }));

  const EditCell = ({ field, width = 120, type = "text" }) => (
    <input type={type} value={editForm[field] ?? ""}
      onChange={e => setEditForm(p => ({ ...p, [field]: e.target.value }))}
      style={{ width, padding: "4px 7px", borderRadius: 6, border: "1.5px solid #6366f1", fontSize: 12, outline: "none", fontFamily: "'DM Sans',sans-serif" }} />
  );

  return (
    <div>
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: 14, padding: 28, maxWidth: 380, width: "90%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>⚠️</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 600, textAlign: "center", marginBottom: 8 }}>Delete Student?</div>
            <div style={{ fontSize: 13, color: "#64748b", textAlign: "center", marginBottom: 22 }}>
              This will permanently remove <b>{students.find(s => s.id === deleteId)?.name}</b> and all their exam marks.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteId(null)} style={{ ...css.btn, flex: 1, background: "#F3F4F6", color: "#374151" }}>Cancel</button>
              <button onClick={confirmDelete} style={{ ...css.btn, flex: 1, background: "#DC2626", color: "white" }}>🗑️ Delete</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={() => setView("list")} style={{ ...css.btn, padding: "8px 20px", background: view === "list" ? "#1a3c2e" : "#F3F4F6", color: view === "list" ? "white" : "#374151" }}>
          📋 All Students ({students.length})
        </button>
        {perm.canEdit && (
          <button onClick={() => { setView("add"); setError(""); setForm(EMPTY_FORM); setSaved(false); }} style={{ ...css.btn, padding: "8px 20px", background: view === "add" ? "#1a3c2e" : "#F3F4F6", color: view === "add" ? "white" : "#374151" }}>
            ➕ Add New Student
          </button>
        )}
      </div>

      {view === "add" && (
        <div style={{ maxWidth: 560 }}>
          <div style={{ background: "white", borderRadius: 14, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", overflow: "hidden", marginBottom: 20 }}>
            <div style={{ background: "linear-gradient(135deg,#1a3c2e,#2A5C45)", padding: "18px 24px" }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: "white", fontWeight: 400 }}>➕ Register New Student</div>
            </div>
            <div style={{ padding: 24 }}>
              {error && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>⚠️ {error}</div>}
              {saved && <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 16 }}>✅ Student added successfully!</div>}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Full Name *</label>
                <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. LAISHRAM TOMTHIN SINGH" style={{ ...css.input, fontSize: 14 }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>GCC No. *</label>
                  <input type="number" value={form.gcc_no} onChange={e => setForm(p => ({ ...p, gcc_no: e.target.value }))} placeholder="e.g. 1125" style={css.input} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Admission No.</label>
                  <input value={form.admission_no} onChange={e => setForm(p => ({ ...p, admission_no: e.target.value }))} placeholder="Optional" style={css.input} />
                </div>
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase" }}>Course *</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {courses.map(c => (
                    <button key={c} onClick={() => setForm(p => ({ ...p, course: c, class_name: "" }))}
                      style={{ ...css.btn, padding: "6px 16px", fontSize: 12, background: form.course === c ? "#1a3c2e" : "#F3F4F6", color: form.course === c ? "white" : "#374151", border: form.course === c ? "none" : "1px solid #E5E7EB" }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase" }}>Batch *</label>
                {batchesForCourse(form.course).length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    {batchesForCourse(form.course).map(b => (
                      <button key={b} onClick={() => setForm(p => ({ ...p, class_name: b }))}
                        style={{ ...css.btn, padding: "5px 14px", fontSize: 12, background: form.class_name === b ? "#7c3aed" : "#F5F3FF", color: form.class_name === b ? "white" : "#5B21B6", border: form.class_name === b ? "none" : "1px solid #DDD6FE" }}>
                        {b}
                      </button>
                    ))}
                  </div>
                )}
                <input value={form.class_name} onChange={e => setForm(p => ({ ...p, class_name: e.target.value }))} placeholder="Type batch name or pick above…" style={css.input} />
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => { setView("list"); setError(""); }} style={{ ...css.btn, background: "#F3F4F6", color: "#374151", flex: 1 }}>Cancel</button>
                <button onClick={handleAdd} disabled={saving} style={{ ...css.btn, background: saving ? "#93C5FD" : "#1a3c2e", color: "white", flex: 2, fontSize: 14 }}>
                  {saving ? "⏳ Saving…" : "✅ Add Student"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {view === "list" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10, marginBottom: 16 }}>
            {statsPerCourse.map(s => (
              <div key={s.course} style={{ background: "white", borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderTop: "3px solid #1a3c2e" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: ".08em" }}>{s.course}</div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 600, color: "#1a3c2e", lineHeight: 1.2, marginTop: 4 }}>{s.count}</div>
                <div style={{ fontSize: 10, color: "#9CA3AF", marginTop: 3 }}>{s.batches.join(", ") || "no batches"}</div>
              </div>
            ))}
            <div style={{ background: "#1a3c2e", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>Total</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 600, color: "white", lineHeight: 1.2, marginTop: 4 }}>{students.length}</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <input placeholder="🔍 Search by name or GCC…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...css.input, flex: 1, minWidth: 180 }} />
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {["ALL", ...courses].map(c => (
                <button key={c} onClick={() => setFilterCourse(c)}
                  style={{ ...css.btn, padding: "5px 12px", fontSize: 11, background: filterCourse === c ? "#1a3c2e" : "#F3F4F6", color: filterCourse === c ? "white" : "#374151", border: filterCourse === c ? "none" : "1px solid #E5E7EB" }}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: isMobile ? 480 : "auto" }}>
              <thead>
                <tr style={{ background: "#1a3c2e" }}>
                  {["GCC No.", "Name", "Batch", "Course", "Adm. No.", "Actions"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: h === "Name" ? "left" : "center", color: "white", fontWeight: 700, fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((st, i) => (
                  <tr key={st.id} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                    {editId === st.id ? (
                      <>
                        <td style={{ padding: "6px 8px", textAlign: "center" }}><EditCell field="gcc_no" width={60} type="number" /></td>
                        <td style={{ padding: "6px 8px" }}><EditCell field="name" width={160} /></td>
                        <td style={{ padding: "6px 8px", textAlign: "center" }}><EditCell field="class_name" width={80} /></td>
                        <td style={{ padding: "6px 8px", textAlign: "center" }}>
                          <select value={editForm.course || ""} onChange={e => setEditForm(p => ({ ...p, course: e.target.value }))} style={{ ...css.input, width: 100, fontSize: 12 }}>
                            {courses.map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "center" }}><EditCell field="admission_no" width={80} /></td>
                        <td style={{ padding: "6px 8px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                            <button onClick={() => saveEdit(st.id)} disabled={editSaving} style={{ ...css.btn, padding: "4px 10px", background: "#1a3c2e", color: "white", fontSize: 11 }}>{editSaving ? "…" : "✓"}</button>
                            <button onClick={cancelEdit} style={{ ...css.btn, padding: "4px 8px", background: "#F3F4F6", color: "#374151", fontSize: 11 }}>✕</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: "9px 12px", textAlign: "center", fontWeight: 700, color: "#1a3c2e" }}>{st.gcc_no}</td>
                        <td style={{ padding: "9px 12px", fontWeight: 600, color: "#1e293b" }}>{st.name}</td>
                        <td style={{ padding: "9px 12px", textAlign: "center" }}>
                          <span style={{ background: "#E0F2FE", color: "#0369A1", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{st.class_name || "—"}</span>
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "center" }}>
                          <span style={{ background: "#E1F5EE", color: "#0F6E56", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{st.course || "—"}</span>
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>{st.admission_no || "—"}</td>
                        <td style={{ padding: "9px 12px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                            <button onClick={() => startEdit(st)} style={{ ...css.btn, padding: "4px 10px", background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", fontSize: 11 }}>✏️</button>
                            {perm.canDelete && <button onClick={() => setDeleteId(st.id)} style={{ ...css.btn, padding: "4px 8px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", fontSize: 11 }}>🗑️</button>}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#94A3B8" }}>No students found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── MERIT LIST ───────────────────────────────────────────────────────────────
function MeritList({ courseSubjects, examTypes, students }) {
  const isMobile = useMobile();
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const subjects = courseSubjects[course] || [];
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course || (s.course || "").toUpperCase() === course
  );
  const courseMax = getCourseMax(course);
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState("");
  const [marks, setMarks] = useState({});
  const [dates, setDates] = useState([]);
  const [rankFilter, setRankFilter] = useState("");

  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]);
    });
  }, [examType]);

  useEffect(() => {
    if (!examType || !examDate) return;
    const ids = courseStudents.map(s => s.id);
    supabase.from("exam_marks").select("*").eq("exam_type_id", examType).eq("exam_date", examDate).in("student_id", ids.length ? ids : ["__none__"]).then(({ data }) => {
      const map = {}; (data || []).forEach(r => { map[`${r.student_id}-${r.subject}`] = r.marks; }); setMarks(map);
    });
  }, [examType, examDate, course]);

  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);
  const ranked = [...courseStudents].map(st => ({ ...st, total: getTotal(st.id), pct: calcPct(getTotal(st.id), course) })).sort((a, b) => b.total - a.total);
  let cr = 1, pt = null;
  const rankedWithRanks = ranked.map((st, i) => { if (i === 0) { cr = 1; pt = st.total; } else if (st.total !== pt) { cr++; pt = st.total; } return { ...st, rank: cr }; });
  const filtered = rankedWithRanks.filter(st => !rankFilter || st.rank <= parseInt(rankFilter));
  const medals = ["🥇", "🥈", "🥉"];

  const handlePrint = () => {
    const rows = filtered.map((st, i) => {
      const grade = getGrade(st.pct);
      const medal = i < 3 ? medals[i] : "";
      return `<tr><td style="text-align:center">${medal} ${st.rank}</td><td>${st.name}</td><td style="text-align:center">${st.gcc_no || "—"}</td><td style="text-align:center;font-weight:700">${st.total}/${courseMax}</td><td style="text-align:center">${st.pct.toFixed(1)}%</td><td style="text-align:center"><span class="badge" style="background:${grade.bg};color:${grade.color}">${grade.label}</span></td></tr>`;
    }).join("");
    printHTML(`<div class="page"><div class="header"><div class="eyebrow">Merit List · ${course}</div><div class="inst-name">Guidance Navodaya & Sainik Institute</div><div class="inst-addr">Khangabok, Manipur</div><div class="exam-pill">${examTypes.find(e => e.id === examType)?.name || ""} · ${examDate}</div></div><div class="body"><table><thead><tr><th>Rank</th><th style="text-align:left">Student</th><th>GCC No</th><th>Total</th><th>%</th><th>Grade</th></tr></thead><tbody>${rows}</tbody></table></div></div>`, `Merit List – ${course}`);
  };

  return (
    <div>
      <div style={{ ...css.card, background: "#F8FAFC", marginBottom: 14 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setMarks({}); }} />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 180 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select>
        </div>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Date</label>
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 160 }}>{dates.map(d => <option key={d} value={d}>{d}</option>)}</select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Top Rank</label>
          <select value={rankFilter} onChange={e => setRankFilter(e.target.value)} style={{ ...css.input, width: 110 }}>
            <option value="">All</option><option value="3">Top 3</option><option value="5">Top 5</option><option value="10">Top 10</option><option value="20">Top 20</option>
          </select>
        </div>
        <button onClick={handlePrint} style={{ ...css.btn, background: "#1a3c2e", color: "white" }}>🖨️ Print</button>
      </div>
      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>📜 Merit List — {course} ({filtered.length} students)</div>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: isMobile ? 380 : "auto" }}>
            <thead><tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
              {["Rank", "Student", "GCC No", "Total", "%", "Grade"].map(h => <th key={h} style={{ padding: "10px 12px", textAlign: h === "Student" ? "left" : "center", fontWeight: 700, color: "#374151", fontSize: 11 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map((st, i) => {
                const grade = getGrade(st.pct);
                return (
                  <tr key={st.id} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800, fontSize: i < 3 ? 15 : 12, color: i < 3 ? "#D97706" : "#374151" }}>{i < 3 ? medals[i] : ""} {st.rank}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 600, fontSize: isMobile ? 12 : 13 }}>{st.name}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center", color: "#64748b" }}>{st.gcc_no || "—"}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800 }}>{st.total}<span style={{ fontSize: 10, color: "#9CA3AF" }}>/{courseMax}</span></td>
                    <td style={{ padding: "10px 12px", textAlign: "center", color: grade.color, fontWeight: 700 }}>{st.pct.toFixed(1)}%</td>
                    <td style={{ padding: "10px 12px", textAlign: "center" }}><Badge label={grade.label} color={grade.color} bg={grade.bg} /></td>
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

// ─── COURSE SUBJECTS MANAGER ──────────────────────────────────────────────────
function CourseSubjectsManager({ courseSubjects, onUpdate }) {
  const courses = Object.keys(courseSubjects);
  const [selected, setSelected] = useState(courses[0] || "");
  const [list, setList] = useState(courseSubjects[selected] || []);
  const [newSub, setNew] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setList(courseSubjects[selected] || []); }, [selected, courseSubjects]);

  const save = async () => {
    setSaving(true);
    const updated = { ...courseSubjects, [selected]: list };
    await supabase.from("system_settings").upsert({ key: "course_subjects", value: JSON.stringify(updated) }, { onConflict: "key" });
    onUpdate(updated); setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addCourse = () => {
    const name = newCourse.trim().toUpperCase();
    if (!name || courseSubjects[name]) return;
    const updated = { ...courseSubjects, [name]: [] };
    onUpdate(updated); setSelected(name); setList([]); setNewCourse("");
  };

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={css.card}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 17, color: "#1e293b", marginBottom: 16 }}>📚 Subjects per Course / Batch</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {Object.keys(courseSubjects).map(c => (
            <button key={c} onClick={() => setSelected(c)}
              style={{ ...css.btn, padding: "6px 16px", background: selected === c ? "#1a3c2e" : "#F3F4F6", color: selected === c ? "white" : "#374151", border: "1.5px solid " + (selected === c ? "#1a3c2e" : "#E5E7EB") }}>
              {c} <span style={{ fontSize: 11, opacity: 0.7 }}>({(courseSubjects[c] || []).length})</span>
            </button>
          ))}
          <div style={{ display: "flex", gap: 6 }}>
            <input value={newCourse} onChange={e => setNewCourse(e.target.value)} placeholder="New course…" style={{ ...css.input, width: 120, fontSize: 12 }}
              onKeyDown={e => { if (e.key === "Enter") addCourse(); }} />
            <button onClick={addCourse} style={{ ...css.btn, padding: "6px 12px", background: "#E0F2FE", color: "#0369A1", fontSize: 12 }}>+ Add</button>
          </div>
        </div>
        {selected && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginBottom: 8 }}>
              Subjects for <span style={{ color: "#1a3c2e" }}>{selected}</span>
              <span style={{ marginLeft: 8, fontWeight: 400, color: "#9CA3AF" }}>(Max: {getCourseMax(selected)})</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {list.map((sub, i) => (
                <span key={sub} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", background: "#E0F2FE", border: "1px solid #BAE6FD", borderRadius: 999, fontSize: 13, color: "#0369A1" }}>
                  <span style={{ fontSize: 10, color: "#94A3B8", fontWeight: 700 }}>{i + 1}.</span>
                  {sub}
                  <span style={{ fontSize: 10, color: "#7DD3FC", fontWeight: 600 }}>/{getSubjectMax(selected, sub)}</span>
                  <span onClick={() => setList(p => p.filter(s => s !== sub))} style={{ cursor: "pointer", color: "#7DD3FC", fontWeight: 800, fontSize: 15 }}>×</span>
                </span>
              ))}
              {!list.length && <span style={{ color: "#CBD5E1", fontSize: 13 }}>No subjects added yet.</span>}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input value={newSub} onChange={e => setNew(e.target.value)} placeholder="Add subject name…" style={{ ...css.input, flex: 1 }}
                onKeyDown={e => { if (e.key === "Enter" && newSub.trim()) { setList(p => [...p, newSub.trim()]); setNew(""); } }} />
              <button onClick={() => { if (newSub.trim()) { setList(p => [...p, newSub.trim()]); setNew(""); } }} style={{ ...css.btn, background: "#1D4ED8", color: "white" }}>Add</button>
            </div>
            <SaveBtn onClick={save} saving={saving} saved={saved} label={`Save ${selected} Subjects`} />
          </>
        )}
      </div>
      <div style={{ ...css.card, background: "#F8FAFC" }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 15, color: "#1e293b", marginBottom: 12 }}>📋 All Courses Summary</div>
        {Object.entries(courseSubjects).map(([c, subs]) => (
          <div key={c} style={{ marginBottom: 10, padding: "10px 14px", background: "white", borderRadius: 8, border: "1px solid #E5E7EB" }}>
            <div style={{ fontWeight: 700, color: "#1a3c2e", fontSize: 13, marginBottom: 4 }}>
              {c} <span style={{ color: "#9CA3AF", fontWeight: 400 }}>({subs.length} subjects · max {getCourseMax(c)} marks)</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {subs.map(s => (
                <span key={s} style={{ fontSize: 11, padding: "2px 8px", background: "#F1F5F9", borderRadius: 999, color: "#475569" }}>
                  {s} <span style={{ color: "#94A3B8" }}>/{getSubjectMax(c, s)}</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
function ExamSettings({ institute, onUpdateInstitute }) {
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false);
  const [config, setConfig] = useState({ ...INSTITUTE_DEFAULT, ...institute });
  const updateConfig = (key, val) => setConfig(p => ({ ...p, [key]: val }));
  const save = async () => {
    setSaving(true);
    await supabase.from("system_settings").upsert({ key: "exam_institute_config", value: JSON.stringify(config) }, { onConflict: "key" });
    onUpdateInstitute(config); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };
  return (
    <div style={{ maxWidth: 700 }}>
      <div style={css.card}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 18, color: "#1e293b", marginBottom: 16 }}>🏛️ Institute Information</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
          {[
            { label: "Institute Name", key: "name" }, { label: "Address", key: "address" },
            { label: "Tagline", key: "tagline" }, { label: "Principal Name", key: "principal" },
            { label: "Class Teacher", key: "teacher" }, { label: "Logo URL", key: "logoUrl" },
            { label: "Academic Year", key: "academicYear" },
          ].map(f => (
            <div key={f.key}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>{f.label}</label>
              <input value={config[f.key] || ""} onChange={e => updateConfig(f.key, e.target.value)} style={css.input} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 16 }}><SaveBtn onClick={save} saving={saving} saved={saved} label="Save Settings" /></div>
      </div>
    </div>
  );
}

// ─── SCHEDULE (v2 — Full Bulk Assign + Mobile) ────────────────────────────────
function Schedule({ courseSubjects, examTypes, onScheduleChange }) {
  const isMobile = useMobile();
  const courses = Object.keys(courseSubjects);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCourse, setFilterCourse] = useState("ALL");
  const [filterExamType, setFilterExamType] = useState("ALL");
  const [mode, setMode] = useState("single");
  const fileInputRef = useRef(null);

  const [form, setForm] = useState({
    exam_type_id: examTypes[0]?.id || "", course: courses[0] || "",
    subject: "", exam_date: "", time: "09:00", total_marks: 100, room: "", shift: "Morning"
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [msExamType, setMsExamType] = useState(examTypes[0]?.id || "");
  const [msCourse, setMsCourse] = useState(courses[0] || "");
  const [msStartDate, setMsStartDate] = useState("");
  const [msTime, setMsTime] = useState("09:00");
  const [msShift, setMsShift] = useState("Morning");
  const [msRoom, setMsRoom] = useState("");
  const [msRows, setMsRows] = useState([]);
  const [msSaving, setMsSaving] = useState(false);
  const [msSaved, setMsSaved] = useState(false);

  const [bkExamType, setBkExamType] = useState(examTypes[0]?.id || "");
  const [bkSubject, setBkSubject] = useState("");
  const [bkDate, setBkDate] = useState("");
  const [bkTime, setBkTime] = useState("09:00");
  const [bkShift, setBkShift] = useState("Morning");
  const [bkRoom, setBkRoom] = useState("");
  const [bkMarks, setBkMarks] = useState(100);
  const [bkCourses, setBkCourses] = useState(new Set());
  const [bkSaving, setBkSaving] = useState(false);
  const [bkSaved, setBkSaved] = useState(false);

  const [genExamType, setGenExamType] = useState(examTypes[0]?.id || "");
  const [genCourse, setGenCourse] = useState(courses[0] || "");
  const [genStartDate, setGenStartDate] = useState("");
  const [genTime, setGenTime] = useState("09:00");
  const [genShift, setGenShift] = useState("Morning");
  const [genRoom, setGenRoom] = useState("");
  const [genSkipWeekends, setGenSkipWeekends] = useState(true);
  const [genSubjectOrder, setGenSubjectOrder] = useState([]);
  const [genPreview, setGenPreview] = useState([]);
  const [genSaving, setGenSaving] = useState(false);
  const [genSaved, setGenSaved] = useState(false);

  const [dupIds, setDupIds] = useState(new Set());
  const [dupDate, setDupDate] = useState("");
  const [dupSaving, setDupSaving] = useState(false);
  const [dupSaved, setDupSaved] = useState(false);

  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importSaving, setImportSaving] = useState(false);
  const [importDone, setImportDone] = useState(false);

  const fetchSchedule = async () => {
    setLoading(true);
    const { data } = await supabase.from("exam_schedule").select("*").order("exam_date", { ascending: true });
    setSchedule(data || []); setLoading(false);
  };
  useEffect(() => { fetchSchedule(); }, []);

  useEffect(() => {
    const subs = courseSubjects[msCourse] || [];
    setMsRows(subs.map((subject) => ({ subject, date: "", marks: getSubjectMax(msCourse, subject) })));
  }, [msCourse]);

  useEffect(() => {
    if (!msStartDate) return;
    setMsRows(prev => {
      let d = new Date(msStartDate);
      return prev.map((r) => {
        const dateStr = d.toISOString().split("T")[0];
        d.setDate(d.getDate() + 1);
        return { ...r, date: dateStr };
      });
    });
  }, [msStartDate]);

  useEffect(() => {
    const subs = courseSubjects[genCourse] || [];
    setGenSubjectOrder(subs.map(s => ({ subject: s, marks: getSubjectMax(genCourse, s) })));
    setGenPreview([]);
  }, [genCourse]);

  useEffect(() => {
    if (!genStartDate || !genSubjectOrder.length) { setGenPreview([]); return; }
    let d = new Date(genStartDate);
    const rows = [];
    for (const { subject, marks } of genSubjectOrder) {
      if (genSkipWeekends) { while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1); }
      rows.push({ subject, exam_date: d.toISOString().split("T")[0], total_marks: marks });
      d.setDate(d.getDate() + 1);
    }
    setGenPreview(rows);
  }, [genStartDate, genSubjectOrder, genSkipWeekends]);

  const handleSaveSingle = async () => {
    if (!form.exam_date || !form.subject) return;
    setSaving(true);
    await supabase.from("exam_schedule").insert([{ ...form, total_marks: Number(form.total_marks) }]);
    setSaving(false); setSaved(true); fetchSchedule(); onScheduleChange?.();
    setTimeout(() => setSaved(false), 2000);
  };

  const handleSaveMulti = async () => {
    const valid = msRows.filter(r => r.subject && r.date);
    if (!valid.length) return;
    setMsSaving(true);
    const rows = valid.map(r => ({ exam_type_id: msExamType, course: msCourse, subject: r.subject, exam_date: r.date, time: msTime, shift: msShift, room: msRoom, total_marks: Number(r.marks) || 100 }));
    await supabase.from("exam_schedule").insert(rows);
    setMsSaving(false); setMsSaved(true); fetchSchedule(); onScheduleChange?.();
    setTimeout(() => setMsSaved(false), 2000);
  };

  const handleSaveBulk = async () => {
    if (!bkDate || !bkSubject || !bkCourses.size) return;
    setBkSaving(true);
    const rows = [...bkCourses].map(c => ({ exam_type_id: bkExamType, course: c, subject: bkSubject, exam_date: bkDate, time: bkTime, shift: bkShift, room: bkRoom, total_marks: Number(bkMarks) || 100 }));
    await supabase.from("exam_schedule").insert(rows);
    setBkSaving(false); setBkSaved(true); fetchSchedule(); onScheduleChange?.();
    setTimeout(() => setBkSaved(false), 2000);
  };

  const handleSaveGenerate = async () => {
    if (!genPreview.length) return;
    setGenSaving(true);
    const rows = genPreview.map(r => ({ exam_type_id: genExamType, course: genCourse, subject: r.subject, exam_date: r.exam_date, time: genTime, shift: genShift, room: genRoom, total_marks: Number(r.total_marks) || 100 }));
    await supabase.from("exam_schedule").insert(rows);
    setGenSaving(false); setGenSaved(true); fetchSchedule(); onScheduleChange?.();
    setTimeout(() => setGenSaved(false), 2500);
  };

  const handleDuplicate = async () => {
    if (!dupDate || !dupIds.size) return;
    setDupSaving(true);
    const toDup = schedule.filter(s => dupIds.has(s.id));
    const rows = toDup.map(({ id, created_at, ...rest }) => ({ ...rest, exam_date: dupDate }));
    await supabase.from("exam_schedule").insert(rows);
    setDupSaving(false); setDupSaved(true); setDupIds(new Set()); fetchSchedule(); onScheduleChange?.();
    setTimeout(() => setDupSaved(false), 2500);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return; e.target.value = "";
    await ensureLibs(); const XLSX = window.XLSX;
    let rows = [];
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "csv") {
      const text = await file.text();
      rows = text.trim().split("\n").map(l => l.split(",").map(c => c.replace(/^"|"$/g, "").trim()));
    } else {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
    }
    if (!rows.length) return;
    const headers = rows[0].map(h => String(h).trim().toLowerCase());
    const col = (name) => headers.findIndex(h => h.includes(name));
    const parsed = []; const errors = [];
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const course    = r[col("course")]?.toString().trim().toUpperCase();
      const subject   = r[col("subject")]?.toString().trim();
      const exam_date = r[col("date")]?.toString().trim();
      const exam_type_id = examTypes.find(et => et.name.toLowerCase().includes(r[col("type")]?.toString().toLowerCase()))?.id || examTypes[0]?.id;
      if (!course || !subject || !exam_date) { errors.push(`Row ${i+1}: missing course/subject/date`); continue; }
      parsed.push({ exam_type_id, course, subject, exam_date, time: r[col("time")]?.toString().trim() || "09:00", shift: r[col("shift")]?.toString().trim() || "Morning", room: r[col("room")]?.toString().trim() || "", total_marks: Number(r[col("marks")]) || 100 });
    }
    setImportRows(parsed); setImportErrors(errors); setImportDone(false);
  };

  const handleImportSave = async () => {
    if (!importRows.length) return;
    setImportSaving(true);
    await supabase.from("exam_schedule").insert(importRows);
    setImportSaving(false); setImportDone(true); fetchSchedule(); onScheduleChange?.();
  };

  const downloadImportTemplate = () => {
    const headers = ["course","subject","date","type","time","shift","room","marks"];
    const example = [courses[0]||"ACHIEVER", courseSubjects[courses[0]]?.[0]||"Mathematics", "2025-06-01", examTypes[0]?.name||"1st Monthly Test", "09:00", "Morning", "Hall A", "100"];
    const csv = [headers, example].map(r => r.join(",")).join("\n");
    const a = document.createElement("a"); a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv); a.download = "GNSI_Schedule_Import_Template.csv"; a.click();
  };

  const handleDelete = async id => {
    if (!confirm("Delete this entry?")) return;
    await supabase.from("exam_schedule").delete().eq("id", id);
    fetchSchedule(); onScheduleChange?.();
  };

  const filtered = schedule.filter(s => {
    const matchCourse = filterCourse === "ALL" || s.course === filterCourse;
    const matchType = filterExamType === "ALL" || s.exam_type_id === filterExamType;
    return matchCourse && matchType;
  });

  const ModeBtn = ({ id, icon, label }) => (
    <button onClick={() => setMode(id)}
      style={{ ...css.btn, padding: isMobile ? "7px 10px" : "8px 16px", background: mode === id ? "#1a3c2e" : "#F3F4F6", color: mode === id ? "white" : "#374151", border: mode === id ? "none" : "1px solid #E5E7EB", fontSize: isMobile ? 11 : 12 }}>
      {icon} {isMobile ? "" : label}
    </button>
  );

  const FieldLabel = ({ children }) => (
    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>{children}</label>
  );

  // Responsive two-col style
  const twoCols = {
    display: isMobile ? "flex" : "grid",
    flexDirection: "column",
    gridTemplateColumns: "320px 1fr",
    gap: isMobile ? 14 : 20,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Mode switcher */}
      <div style={{ background: "white", borderRadius: 12, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", marginRight: 4 }}>Mode:</span>
        <ModeBtn id="single"    icon="✏️"  label="Single Entry" />
        <ModeBtn id="multi"     icon="📋" label="Multi-Subject" />
        <ModeBtn id="bulk"      icon="🔀" label="One Subject → Many Courses" />
        <ModeBtn id="generate"  icon="⚡" label="Auto-Generate Timetable" />
        <ModeBtn id="duplicate" icon="📄" label="Duplicate Entries" />
        <ModeBtn id="import"    icon="📂" label="Import CSV/Excel" />
      </div>

      {/* SINGLE ENTRY */}
      {mode === "single" && (
        <div style={twoCols}>
          <div style={css.card}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 14 }}>➕ Add Single Entry</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><FieldLabel>Exam Type</FieldLabel>
                <select value={form.exam_type_id} onChange={e => setForm(p => ({ ...p, exam_type_id: e.target.value }))} style={css.input}>
                  {examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select></div>
              <div><FieldLabel>Course / Batch</FieldLabel>
                <select value={form.course} onChange={e => setForm(p => ({ ...p, course: e.target.value, subject: "" }))} style={css.input}>
                  {courses.map(c => <option key={c} value={c}>{c}</option>)}
                </select></div>
              <div><FieldLabel>Subject</FieldLabel>
                <select value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} style={css.input}>
                  <option value="">— Select Subject —</option>
                  {(courseSubjects[form.course] || []).map(s => <option key={s} value={s}>{s}</option>)}
                </select></div>
              <div><FieldLabel>Date</FieldLabel>
                <input type="date" value={form.exam_date} onChange={e => setForm(p => ({ ...p, exam_date: e.target.value }))} style={css.input} /></div>
              <div><FieldLabel>Shift</FieldLabel>
                <select value={form.shift} onChange={e => setForm(p => ({ ...p, shift: e.target.value }))} style={css.input}>
                  <option value="Morning">🌅 Morning</option><option value="Afternoon">🌤️ Afternoon</option><option value="Evening">🌆 Evening</option>
                </select></div>
              <div><FieldLabel>Time</FieldLabel>
                <input type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} style={css.input} /></div>
              <div><FieldLabel>Total Marks</FieldLabel>
                <input type="number" value={form.total_marks} onChange={e => setForm(p => ({ ...p, total_marks: e.target.value }))} style={css.input} /></div>
              <div><FieldLabel>Room / Hall</FieldLabel>
                <input value={form.room} onChange={e => setForm(p => ({ ...p, room: e.target.value }))} style={css.input} /></div>
              <SaveBtn onClick={handleSaveSingle} saving={saving} saved={saved} label="Add Entry" />
            </div>
          </div>
          <ScheduleTable schedule={filtered} examTypes={examTypes} courses={courses}
            filterCourse={filterCourse} setFilterCourse={setFilterCourse}
            filterExamType={filterExamType} setFilterExamType={setFilterExamType}
            onDelete={handleDelete} selectable={false} />
        </div>
      )}

      {/* MULTI-SUBJECT */}
      {mode === "multi" && (
        <div style={{ display: isMobile ? "flex" : "grid", flexDirection: "column", gridTemplateColumns: "1fr 1fr", gap: isMobile ? 14 : 20 }}>
          <div style={css.card}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 4 }}>📋 Multi-Subject Entry</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14 }}>Add all subjects for a course at once.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              <div><FieldLabel>Exam Type</FieldLabel>
                <select value={msExamType} onChange={e => setMsExamType(e.target.value)} style={css.input}>
                  {examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select></div>
              <div><FieldLabel>Course / Batch</FieldLabel>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {courses.map(c => <button key={c} onClick={() => setMsCourse(c)} style={{ ...css.btn, padding: "5px 12px", fontSize: 11, background: msCourse === c ? "#1a3c2e" : "#F3F4F6", color: msCourse === c ? "white" : "#374151", border: msCourse === c ? "none" : "1px solid #E5E7EB" }}>{c}</button>)}
                </div></div>
              <div><FieldLabel>Auto-fill Start Date</FieldLabel>
                <input type="date" value={msStartDate} onChange={e => setMsStartDate(e.target.value)} style={{ ...css.input, width: 180 }} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><FieldLabel>Shift</FieldLabel><select value={msShift} onChange={e => setMsShift(e.target.value)} style={css.input}><option>Morning</option><option>Afternoon</option><option>Evening</option></select></div>
                <div><FieldLabel>Time</FieldLabel><input type="time" value={msTime} onChange={e => setMsTime(e.target.value)} style={css.input} /></div>
              </div>
              <div><FieldLabel>Room</FieldLabel><input value={msRoom} onChange={e => setMsRoom(e.target.value)} style={css.input} /></div>
            </div>
            <button onClick={handleSaveMulti} disabled={msSaving}
              style={{ ...css.btn, background: msSaved ? "#16A34A" : msSaving ? "#93C5FD" : "#1a3c2e", color: "white", width: "100%", fontSize: 13 }}>
              {msSaved ? `✓ Saved!` : msSaving ? "Saving…" : `💾 Save ${msRows.filter(r=>r.date).length} Entries`}
            </button>
          </div>
          <div style={css.card}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Subjects for <span style={{ color: "#1a3c2e" }}>{msCourse}</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 480, overflowY: "auto" }}>
              {msRows.map((r, i) => (
                <div key={r.subject} style={{ display: "grid", gridTemplateColumns: "1fr 130px 70px", gap: 8, alignItems: "center", padding: "8px 10px", background: i % 2 ? "#F9FAFB" : "white", borderRadius: 8, border: "1px solid #F1F5F9" }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}><span style={{ fontSize: 10, color: "#94A3B8", marginRight: 4 }}>{i+1}.</span>{r.subject}</div>
                  <input type="date" value={r.date} onChange={e => setMsRows(p => p.map((x, j) => j === i ? { ...x, date: e.target.value } : x))} style={{ ...css.input, fontSize: 12, padding: "5px 8px" }} />
                  <input type="number" value={r.marks} onChange={e => setMsRows(p => p.map((x, j) => j === i ? { ...x, marks: e.target.value } : x))} style={{ ...css.input, fontSize: 12, padding: "5px 8px" }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* BULK */}
      {mode === "bulk" && (
        <div style={twoCols}>
          <div style={css.card}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 4 }}>🔀 One Subject → Many Courses</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><FieldLabel>Exam Type</FieldLabel><select value={bkExamType} onChange={e => setBkExamType(e.target.value)} style={css.input}>{examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
              <div><FieldLabel>Subject Name</FieldLabel><input value={bkSubject} onChange={e => setBkSubject(e.target.value)} placeholder="e.g. Mathematics" style={css.input} /></div>
              <div><FieldLabel>Date</FieldLabel><input type="date" value={bkDate} onChange={e => setBkDate(e.target.value)} style={css.input} /></div>
              <div><FieldLabel>Total Marks</FieldLabel><input type="number" value={bkMarks} onChange={e => setBkMarks(e.target.value)} style={css.input} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><FieldLabel>Shift</FieldLabel><select value={bkShift} onChange={e => setBkShift(e.target.value)} style={css.input}><option>Morning</option><option>Afternoon</option><option>Evening</option></select></div>
                <div><FieldLabel>Time</FieldLabel><input type="time" value={bkTime} onChange={e => setBkTime(e.target.value)} style={css.input} /></div>
              </div>
              <div><FieldLabel>Room</FieldLabel><input value={bkRoom} onChange={e => setBkRoom(e.target.value)} style={css.input} /></div>
              <div>
                <FieldLabel>Target Courses ({bkCourses.size} selected)</FieldLabel>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  <button onClick={() => setBkCourses(new Set(courses))} style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: "#E0F2FE", color: "#0369A1" }}>All</button>
                  <button onClick={() => setBkCourses(new Set())} style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: "#FEF2F2", color: "#DC2626" }}>None</button>
                  {courses.map(c => { const sel = bkCourses.has(c); return <button key={c} onClick={() => setBkCourses(p => { const n = new Set(p); sel ? n.delete(c) : n.add(c); return n; })} style={{ ...css.btn, padding: "5px 12px", fontSize: 11, background: sel ? "#1a3c2e" : "#F3F4F6", color: sel ? "white" : "#374151", border: sel ? "none" : "1px solid #E5E7EB" }}>{sel ? "✓ " : ""}{c}</button>; })}
                </div>
              </div>
              <button onClick={handleSaveBulk} disabled={bkSaving || !bkCourses.size || !bkDate || !bkSubject}
                style={{ ...css.btn, background: bkSaved ? "#16A34A" : bkSaving ? "#93C5FD" : "#1a3c2e", color: "white", fontSize: 13 }}>
                {bkSaved ? `✓ Saved!` : bkSaving ? "Saving…" : `💾 Assign to ${bkCourses.size} Courses`}
              </button>
            </div>
          </div>
          <ScheduleTable schedule={filtered} examTypes={examTypes} courses={courses}
            filterCourse={filterCourse} setFilterCourse={setFilterCourse}
            filterExamType={filterExamType} setFilterExamType={setFilterExamType}
            onDelete={handleDelete} selectable={false} />
        </div>
      )}

      {/* AUTO-GENERATE */}
      {mode === "generate" && (
        <div style={{ display: isMobile ? "flex" : "grid", flexDirection: "column", gridTemplateColumns: "320px 1fr", gap: isMobile ? 14 : 20 }}>
          <div style={css.card}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 4 }}>⚡ Auto-Generate Timetable</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><FieldLabel>Exam Type</FieldLabel><select value={genExamType} onChange={e => setGenExamType(e.target.value)} style={css.input}>{examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
              <div><FieldLabel>Course</FieldLabel>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {courses.map(c => <button key={c} onClick={() => setGenCourse(c)} style={{ ...css.btn, padding: "5px 12px", fontSize: 11, background: genCourse === c ? "#1a3c2e" : "#F3F4F6", color: genCourse === c ? "white" : "#374151", border: genCourse === c ? "none" : "1px solid #E5E7EB" }}>{c}</button>)}
                </div></div>
              <div><FieldLabel>Start Date</FieldLabel><input type="date" value={genStartDate} onChange={e => setGenStartDate(e.target.value)} style={css.input} /></div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div><FieldLabel>Shift</FieldLabel><select value={genShift} onChange={e => setGenShift(e.target.value)} style={css.input}><option>Morning</option><option>Afternoon</option><option>Evening</option></select></div>
                <div><FieldLabel>Time</FieldLabel><input type="time" value={genTime} onChange={e => setGenTime(e.target.value)} style={css.input} /></div>
              </div>
              <div><FieldLabel>Room</FieldLabel><input value={genRoom} onChange={e => setGenRoom(e.target.value)} style={css.input} /></div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={genSkipWeekends} onChange={e => setGenSkipWeekends(e.target.checked)} />Skip weekends
              </label>
              <div>
                <FieldLabel>Subject Order</FieldLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                  {genSubjectOrder.map((s, i) => (
                    <div key={s.subject} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#F8FAFC", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <button onClick={() => { if (i === 0) return; const n = [...genSubjectOrder]; [n[i-1], n[i]] = [n[i], n[i-1]]; setGenSubjectOrder(n); }} style={{ ...css.btn, padding: "1px 5px", fontSize: 10, background: "#E5E7EB", color: "#374151" }}>▲</button>
                        <button onClick={() => { if (i === genSubjectOrder.length - 1) return; const n = [...genSubjectOrder]; [n[i], n[i+1]] = [n[i+1], n[i]]; setGenSubjectOrder(n); }} style={{ ...css.btn, padding: "1px 5px", fontSize: 10, background: "#E5E7EB", color: "#374151" }}>▼</button>
                      </div>
                      <span style={{ flex: 1, fontSize: 11, fontWeight: 600 }}>{s.subject}</span>
                      <input type="number" value={s.marks} onChange={e => setGenSubjectOrder(p => p.map((x, j) => j === i ? { ...x, marks: Number(e.target.value) } : x))} style={{ width: 55, padding: "4px 6px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 12 }} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ ...css.card, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
              <div>
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 600, color: "#1e293b" }}>{genPreview.length} exam days generated</div>
                <div style={{ fontSize: 12, color: "#9CA3AF", marginTop: 2 }}>{genCourse} · starts {genStartDate || "—"}</div>
              </div>
              <button onClick={handleSaveGenerate} disabled={!genPreview.length || genSaving}
                style={{ ...css.btn, background: genSaved ? "#16A34A" : genSaving ? "#93C5FD" : "#1a3c2e", color: "white", padding: "10px 22px", fontSize: 13 }}>
                {genSaved ? `✓ Saved!` : genSaving ? "Saving…" : `💾 Save ${genPreview.length} Entries`}
              </button>
            </div>
            <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
              <div style={{ padding: "11px 18px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>📅 Preview</div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 340 }}>
                  <thead><tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
                    {["#","Date","Day","Subject","Marks"].map(h => <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontWeight: 700, color: "#374151", fontSize: 11 }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {genPreview.map((r, i) => {
                      const day = new Date(r.exam_date).toLocaleDateString("en-IN", { weekday: "short" });
                      return <tr key={i} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "8px 14px", color: "#94A3B8", fontSize: 12 }}>{i+1}</td>
                        <td style={{ padding: "8px 14px", fontWeight: 600 }}>{r.exam_date}</td>
                        <td style={{ padding: "8px 14px", color: "#64748b" }}>{day}</td>
                        <td style={{ padding: "8px 14px", fontWeight: 600, color: "#1a3c2e" }}>{r.subject}</td>
                        <td style={{ padding: "8px 14px", color: "#64748b" }}>{r.total_marks}</td>
                      </tr>;
                    })}
                    {!genPreview.length && <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#94A3B8" }}>Set a start date to preview.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DUPLICATE */}
      {mode === "duplicate" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ ...css.card, display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: "#1e293b", flex: "0 0 100%", marginBottom: 4 }}>📄 Duplicate Schedule Entries to a New Date</div>
            <div><FieldLabel>Copy to Date</FieldLabel><input type="date" value={dupDate} onChange={e => setDupDate(e.target.value)} style={{ ...css.input, width: 180 }} /></div>
            <div style={{ fontSize: 12, color: "#9CA3AF", alignSelf: "center" }}>{dupIds.size} entries selected</div>
            <button onClick={handleDuplicate} disabled={!dupIds.size || !dupDate || dupSaving}
              style={{ ...css.btn, background: dupSaved ? "#16A34A" : dupSaving ? "#93C5FD" : "#7c3aed", color: "white", fontSize: 13 }}>
              {dupSaved ? `✓ Duplicated!` : dupSaving ? "Saving…" : `📄 Duplicate ${dupIds.size} Selected`}
            </button>
          </div>
          <ScheduleTable schedule={filtered} examTypes={examTypes} courses={courses}
            filterCourse={filterCourse} setFilterCourse={setFilterCourse}
            filterExamType={filterExamType} setFilterExamType={setFilterExamType}
            onDelete={handleDelete} selectable={true} selected={dupIds}
            onToggle={id => setDupIds(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; })}
            onSelectAll={() => setDupIds(new Set(filtered.map(s => s.id)))}
            onDeselectAll={() => setDupIds(new Set())} />
        </div>
      )}

      {/* IMPORT */}
      {mode === "import" && (
        <div style={{ display: isMobile ? "flex" : "grid", flexDirection: "column", gridTemplateColumns: "320px 1fr", gap: isMobile ? 14 : 20 }}>
          <div style={css.card}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 4 }}>📂 Import from CSV / Excel</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 16 }}>Columns: <b>course, subject, date, type, time, shift, room, marks</b></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={downloadImportTemplate} style={{ ...css.btn, background: "#E0F2FE", color: "#0369A1", border: "1px solid #BAE6FD", fontSize: 12 }}>📋 Download Template</button>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={handleFileUpload} />
              <button onClick={() => fileInputRef.current?.click()} style={{ ...css.btn, background: "#7c3aed", color: "white", fontSize: 13 }}>📂 Upload File</button>
              {importRows.length > 0 && <div style={{ background: "#E1F5EE", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#0F6E56" }}>✅ {importRows.length} rows ready</div>}
              {importErrors.length > 0 && <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#92400E" }}>⚠️ {importErrors.length} rows skipped</div>}
              {importRows.length > 0 && !importDone && (
                <button onClick={handleImportSave} disabled={importSaving} style={{ ...css.btn, background: importSaving ? "#93C5FD" : "#1a3c2e", color: "white", fontSize: 13 }}>
                  {importSaving ? "Saving…" : `💾 Confirm Import (${importRows.length})`}
                </button>
              )}
              {importDone && <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>✅ Import complete!</div>}
            </div>
          </div>
          <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ padding: "11px 18px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>{importRows.length ? `📋 Preview (${importRows.length})` : "📋 Awaiting upload…"}</div>
            {importRows.length > 0 ? (
              <div style={{ overflowX: "auto", maxHeight: 400, overflowY: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 480 }}>
                  <thead style={{ position: "sticky", top: 0 }}>
                    <tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
                      {["Course","Subject","Date","Exam Type","Shift","Time","Room","Marks"].map(h => <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700, color: "#374151", fontSize: 11 }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "8px 12px" }}><span style={{ background: "#E1F5EE", color: "#0F6E56", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{r.course}</span></td>
                        <td style={{ padding: "8px 12px", fontWeight: 600 }}>{r.subject}</td>
                        <td style={{ padding: "8px 12px" }}>{r.exam_date}</td>
                        <td style={{ padding: "8px 12px", color: "#64748b" }}>{examTypes.find(e => e.id === r.exam_type_id)?.name || r.exam_type_id}</td>
                        <td style={{ padding: "8px 12px", color: "#64748b" }}>{r.shift}</td>
                        <td style={{ padding: "8px 12px", color: "#64748b" }}>{r.time}</td>
                        <td style={{ padding: "8px 12px", color: "#64748b" }}>{r.room || "—"}</td>
                        <td style={{ padding: "8px 12px", color: "#64748b" }}>{r.total_marks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div style={{ padding: 60, textAlign: "center", color: "#94A3B8" }}><div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>Upload a file to preview.</div>}
          </div>
        </div>
      )}

      {(mode === "multi" || mode === "generate") && (
        <ScheduleTable schedule={filtered} examTypes={examTypes} courses={courses}
          filterCourse={filterCourse} setFilterCourse={setFilterCourse}
          filterExamType={filterExamType} setFilterExamType={setFilterExamType}
          onDelete={handleDelete} selectable={false} />
      )}
    </div>
  );
}

// ─── Shared Schedule Table ────────────────────────────────────────────────────
function ScheduleTable({ schedule, examTypes, courses, filterCourse, setFilterCourse, filterExamType, setFilterExamType, onDelete, selectable, selected, onToggle, onSelectAll, onDeselectAll }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Filter Course</label>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {["ALL", ...courses].map(c => (
              <button key={c} onClick={() => setFilterCourse(c)}
                style={{ ...css.btn, padding: "5px 10px", fontSize: 11, background: filterCourse === c ? "#1a3c2e" : "#F3F4F6", color: filterCourse === c ? "white" : "#374151", border: filterCourse === c ? "none" : "1px solid #E5E7EB" }}>{c}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Filter Type</label>
          <select value={filterExamType} onChange={e => setFilterExamType(e.target.value)} style={{ ...css.input, width: 180 }}>
            <option value="ALL">All Types</option>
            {examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
          </select>
        </div>
        {selectable && (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onSelectAll} style={{ ...css.btn, padding: "5px 10px", fontSize: 11, background: "#E0F2FE", color: "#0369A1" }}>Select All</button>
            <button onClick={onDeselectAll} style={{ ...css.btn, padding: "5px 10px", fontSize: 11, background: "#FEF2F2", color: "#DC2626" }}>Deselect All</button>
          </div>
        )}
        <div style={{ fontSize: 12, color: "#9CA3AF", alignSelf: "center" }}>{schedule.length} entries</div>
      </div>
      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>📅 Exam Schedule</div>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 520 }}>
            <thead><tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
              {selectable && <th style={{ padding: "10px 12px", width: 36 }}></th>}
              {["Date","Course","Exam Type","Subject","Shift","Time","Marks","Room",""].map(h => (
                <th key={h} style={{ padding: "10px 10px", textAlign: "left", fontWeight: 700, color: "#374151", fontSize: 11 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {schedule.map((s, i) => (
                <tr key={s.id} style={{ background: selectable && selected && selected.has(s.id) ? "#EFF6FF" : i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                  {selectable && <td style={{ padding: "9px 12px", textAlign: "center" }}><input type="checkbox" checked={selected && selected.has(s.id) || false} onChange={() => onToggle(s.id)} /></td>}
                  <td style={{ padding: "9px 10px", fontWeight: 600 }}>{s.exam_date}</td>
                  <td style={{ padding: "9px 10px" }}><span style={{ background: "#E1F5EE", color: "#0F6E56", padding: "2px 7px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{s.course || "—"}</span></td>
                  <td style={{ padding: "9px 10px" }}>{examTypes.find(e => e.id === s.exam_type_id)?.name || s.exam_type_id}</td>
                  <td style={{ padding: "9px 10px" }}>{s.subject}</td>
                  <td style={{ padding: "9px 10px", color: "#64748b" }}>{s.shift || "Morning"}</td>
                  <td style={{ padding: "9px 10px", color: "#64748b" }}>{s.time || "--"}</td>
                  <td style={{ padding: "9px 10px", color: "#64748b" }}>{s.total_marks}</td>
                  <td style={{ padding: "9px 10px", color: "#64748b" }}>{s.room || "--"}</td>
                  <td style={{ padding: "9px 10px" }}><button onClick={() => onDelete(s.id)} style={{ ...css.btn, padding: "4px 8px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", fontSize: 11 }}>✕</button></td>
                </tr>
              ))}
              {!schedule.length && <tr><td colSpan={selectable ? 10 : 9} style={{ padding: 32, textAlign: "center", color: "#94A3B8" }}>No schedule entries yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── SEAT ARRANGEMENT (mobile: stacked layout) ───────────────────────────────
function SeatArrangement({ courseSubjects, examTypes, students, institute, schedule }) {
  const isMobile = useMobile();
  const courses = Object.keys(courseSubjects);

  const [examType, setExamType]     = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate]     = useState("");
  const [dates, setDates]           = useState([]);
  const [room, setRoom]             = useState("");
  const [seats, setSeats]           = useState({});
  const [savedSeats, setSavedSeats] = useState({});
  const [capacity, setCapacity]     = useState(30);
  const [cols, setCols]             = useState(5);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [saved, setSaved]           = useState(false);
  const [filterCourse, setFilterCourse] = useState("ALL");
  const [search, setSearch]         = useState("");
  const [dragStudent, setDragStudent] = useState(null);

  const scheduleRooms = [...new Set(
    schedule.filter(s => s.exam_type_id === examType && (!examDate || s.exam_date === examDate) && s.room).map(s => s.room)
  )];
  const [allRooms, setAllRooms] = useState([]);

  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data||[]).map(r=>r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]);
    });
  }, [examType]);

  useEffect(() => {
    if (!examType || !examDate) return;
    supabase.from("seat_arrangements").select("room").eq("exam_type_id", examType).eq("exam_date", examDate).then(({ data }) => {
      const dbRooms = [...new Set((data||[]).map(r=>r.room))];
      const combined = [...new Set([...scheduleRooms, ...dbRooms])];
      setAllRooms(combined);
      if (!room && combined.length) setRoom(combined[0]);
    });
  }, [examType, examDate]);

  useEffect(() => {
    if (!examType || !examDate || !room) return;
    setLoading(true);
    supabase.from("seat_arrangements").select("*").eq("exam_type_id", examType).eq("exam_date", examDate).eq("room", room).then(({ data }) => {
      const map = {}; (data||[]).forEach(r => { map[r.seat_number] = r.student_id; });
      setSeats(map); setSavedSeats(map); setLoading(false);
    });
  }, [examType, examDate, room]);

  const assignedInRoom = new Set(Object.values(seats).filter(Boolean));
  const [globalAssigned, setGlobalAssigned] = useState(new Set());
  useEffect(() => {
    if (!examType || !examDate) return;
    supabase.from("seat_arrangements").select("student_id").eq("exam_type_id", examType).eq("exam_date", examDate).then(({ data }) => {
      setGlobalAssigned(new Set((data||[]).map(r=>r.student_id)));
    });
  }, [examType, examDate, seats]);

  const filteredStudents = students.filter(s => {
    const matchCourse = filterCourse==="ALL" || (s.course||"").toUpperCase()===filterCourse;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || String(s.gcc_no).includes(search);
    return matchCourse && matchSearch;
  }).sort((a,b) => {
    const aA = globalAssigned.has(a.id), bA = globalAssigned.has(b.id);
    if (aA !== bA) return aA ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  const autoAssign = () => {
    const unassigned = students.filter(s => (filterCourse==="ALL" || (s.course||"").toUpperCase()===filterCourse) && !globalAssigned.has(s.id));
    const newSeats = { ...seats }; let si = 0;
    for (let seat = 1; seat <= capacity && si < unassigned.length; seat++) {
      if (!newSeats[seat]) { newSeats[seat] = unassigned[si].id; si++; }
    }
    setSeats(newSeats); setSaved(false);
  };

  const clearRoom = () => { setSeats({}); setSaved(false); };

  const handleSave = async () => {
    setSaving(true);
    await supabase.from("seat_arrangements").delete().eq("exam_type_id", examType).eq("exam_date", examDate).eq("room", room);
    const rows = Object.entries(seats).filter(([,sid]) => sid).map(([seatNum, sid]) => ({ exam_type_id: examType, exam_date: examDate, room, student_id: sid, seat_number: Number(seatNum) }));
    if (rows.length) await supabase.from("seat_arrangements").insert(rows);
    setSavedSeats({...seats}); setSaving(false); setSaved(true);
    setAllRooms(p => [...new Set([...p, room])]);
    setTimeout(() => setSaved(false), 2500);
  };

  const [newRoom, setNewRoom] = useState("");
  const addRoom = () => {
    const r = newRoom.trim().toUpperCase(); if (!r) return;
    setAllRooms(p => [...new Set([...p, r])]);
    setRoom(r); setSeats({}); setNewRoom("");
  };

  const examName = examTypes.find(e=>e.id===examType)?.name || "Examination";
  const occupiedCount = Object.values(seats).filter(Boolean).length;
  const rows = Math.ceil(capacity / cols);

  return (
    <div>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:14, alignItems:"flex-end" }}>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:5, textTransform:"uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e=>setExamType(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 200 }}>
            {examTypes.map(et=><option key={et.id} value={et.id}>{et.name}</option>)}
          </select>
        </div>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:5, textTransform:"uppercase" }}>Date</label>
          <select value={examDate} onChange={e=>setExamDate(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 160 }}>
            <option value="">— Pick —</option>
            {dates.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:5, textTransform:"uppercase" }}>Cap.</label>
          <input type="number" value={capacity} onChange={e=>setCapacity(Math.max(1,Number(e.target.value)))} style={{ ...css.input, width:70 }} />
        </div>
        <div>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:5, textTransform:"uppercase" }}>Cols</label>
          <input type="number" value={cols} onChange={e=>setCols(Math.max(1,Math.min(10,Number(e.target.value))))} style={{ ...css.input, width:60 }} />
        </div>
      </div>

      <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:8, padding:"10px 16px", marginBottom:14, fontSize:12, color:"#1D4ED8" }}>
        ℹ️ First time? Run the SQL in the SeatArrangement component comments in Supabase.
      </div>

      {/* Layout: stacked on mobile, side-by-side on desktop */}
      <div style={{ display: isMobile ? "flex" : "grid", flexDirection: "column", gridTemplateColumns: "220px 1fr", gap: isMobile ? 14 : 20 }}>

        {/* Left: Rooms + Student list */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", overflow:"hidden" }}>
            <div style={{ padding:"11px 16px", background:"#1a3c2e", color:"white", fontWeight:700, fontSize:13 }}>🏫 Rooms</div>
            <div style={{ padding:12, display:"flex", flexDirection:"column", gap:6 }}>
              {isMobile ? (
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {allRooms.map(r => (
                    <button key={r} onClick={()=>setRoom(r)} style={{ ...css.btn, padding:"6px 12px", background:room===r?"#1a3c2e":"#F3F4F6", color:room===r?"white":"#374151", border:room===r?"none":"1px solid #E5E7EB", fontSize:12 }}>🏫 {r}</button>
                  ))}
                </div>
              ) : allRooms.map(r => (
                <button key={r} onClick={()=>setRoom(r)} style={{ ...css.btn, padding:"8px 14px", textAlign:"left", background:room===r?"#1a3c2e":"#F3F4F6", color:room===r?"white":"#374151", border:room===r?"none":"1px solid #E5E7EB", fontSize:12 }}>🏫 {r}</button>
              ))}
              {!allRooms.length && <div style={{ fontSize:12, color:"#94A3B8" }}>No rooms yet.</div>}
              <div style={{ display:"flex", gap:6, marginTop:4 }}>
                <input value={newRoom} onChange={e=>setNewRoom(e.target.value)} placeholder="New room…" style={css.input} onKeyDown={e=>{ if(e.key==="Enter") addRoom(); }} />
                <button onClick={addRoom} style={{ ...css.btn, padding:"6px 10px", background:"#E0F2FE", color:"#0369A1", fontSize:12, whiteSpace:"nowrap" }}>+ Add</button>
              </div>
            </div>
          </div>

          <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", overflow:"hidden" }}>
            <div style={{ padding:"11px 16px", background:"#1a3c2e", color:"white", fontWeight:700, fontSize:13 }}>👤 Students</div>
            <div style={{ padding:10 }}>
              <input placeholder="🔍 Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{ ...css.input, marginBottom:8, fontSize:12 }} />
              <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>
                {["ALL",...courses].map(c=>(
                  <button key={c} onClick={()=>setFilterCourse(c)} style={{ ...css.btn, padding:"3px 8px", fontSize:10, background:filterCourse===c?"#1a3c2e":"#F3F4F6", color:filterCourse===c?"white":"#374151", border:filterCourse===c?"none":"1px solid #E5E7EB" }}>{c}</button>
                ))}
              </div>
            </div>
            <div style={{ maxHeight: isMobile ? 180 : 320, overflowY:"auto", borderTop:"1px solid #F1F5F9" }}>
              {filteredStudents.map(st => {
                const inRoom = assignedInRoom.has(st.id);
                const inOther = !inRoom && globalAssigned.has(st.id);
                return (
                  <div key={st.id}
                    draggable={!inRoom}
                    onDragStart={()=>setDragStudent(st)}
                    onDragEnd={()=>setDragStudent(null)}
                    style={{ padding:"8px 14px", borderBottom:"1px solid #F1F5F9", cursor:inRoom?"default":"grab", background:inRoom?"#F0FDF4":inOther?"#FFFBEB":"white", opacity:inRoom?0.6:1 }}>
                    <div style={{ fontWeight:600, fontSize:12, color:inRoom?"#0F6E56":inOther?"#92400E":"#1e293b" }}>{st.name}</div>
                    <div style={{ fontSize:10, color:"#9CA3AF" }}>GCC {st.gcc_no} · {st.class_name||st.course}{inRoom?" · ✓":inOther?" · ⚠️ Other room":""}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Actions + Seat grid */}
        <div>
          <div style={{ display:"flex", gap:8, marginBottom:12, alignItems:"center", flexWrap:"wrap" }}>
            <div style={{ background:"white", borderRadius:10, padding:"10px 14px", boxShadow:"0 1px 4px rgba(0,0,0,0.06)", fontSize:13, fontWeight:600, color:"#1a3c2e" }}>
              🏫 <b>{room||"No room"}</b>
              <span style={{ fontWeight:400, color:"#9CA3AF", marginLeft:8 }}>{occupiedCount}/{capacity}</span>
            </div>
            <button onClick={autoAssign} style={{ ...css.btn, background:"#7c3aed", color:"white", fontSize:12 }}>⚡ Auto</button>
            <button onClick={clearRoom} style={{ ...css.btn, background:"#FEF2F2", color:"#DC2626", border:"1px solid #FECACA", fontSize:12 }}>🗑️ Clear</button>
            <button onClick={handleSave} disabled={saving||!room} style={{ ...css.btn, background:saved?"#16A34A":saving?"#93C5FD":"#1D4ED8", color:"white", fontSize:12 }}>
              {saved?"✓ Saved!":saving?"Saving…":"💾 Save"}
            </button>
          </div>

          <div style={{ background:"white", borderRadius:8, padding:"8px 14px", marginBottom:12, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#6B7280", marginBottom:5 }}>
              <span>Capacity</span><span style={{ fontWeight:700, color:"#1a3c2e" }}>{occupiedCount} / {capacity}</span>
            </div>
            <div style={{ height:6, background:"#F1F5F9", borderRadius:999, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${(occupiedCount/capacity)*100}%`, background:"#1a3c2e", borderRadius:999, transition:"width .3s" }} />
            </div>
          </div>

          {loading ? <Spinner /> : !room ? (
            <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", padding:40, textAlign:"center", color:"#94A3B8" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🏫</div>
              <div style={{ fontSize:14, fontWeight:600 }}>Select or add a room to begin</div>
            </div>
          ) : (
            <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", padding:16, overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
              <div style={{ display:"inline-flex", flexDirection:"column", gap:8, minWidth:"100%" }}>
                <div style={{ display:"flex", gap:8 }}>
                  {Array.from({length:cols},(_,c)=>(
                    <div key={c} style={{ width:100, textAlign:"center", fontSize:10, fontWeight:700, color:"#9CA3AF", textTransform:"uppercase" }}>Col {c+1}</div>
                  ))}
                </div>
                {Array.from({length:rows},(_,r)=>(
                  <div key={r} style={{ display:"flex", gap:8 }}>
                    {Array.from({length:cols},(_,c)=>{
                      const seatNum = r*cols+c+1;
                      if (seatNum > capacity) return <div key={c} style={{ width:100 }} />;
                      const sid = seats[seatNum];
                      const st = sid ? students.find(s=>s.id===sid) : null;
                      return (
                        <div key={seatNum}
                          onDragOver={e=>{e.preventDefault();}}
                          onDrop={e=>{ e.preventDefault(); if(dragStudent && !assignedInRoom.has(dragStudent.id)){ setSeats(p=>({...p,[seatNum]:dragStudent.id})); setSaved(false); setDragStudent(null); }}}
                          onClick={()=>{ if(st){ setSeats(p=>{ const n={...p}; delete n[seatNum]; return n; }); setSaved(false); } }}
                          style={{ width:100, minHeight:66, borderRadius:8, border:st?"1.5px solid #86EFAC":"1.5px dashed #D1D5DB", background:st?"#F0FDF4":"#F9FAFB", padding:"5px 7px", cursor:st?"pointer":"default", position:"relative", transition:"all .15s" }}>
                          <div style={{ position:"absolute", top:4, right:6, fontSize:9, fontWeight:800, color:st?"#0F6E56":"#CBD5E1" }}>{seatNum}</div>
                          {st ? (
                            <>
                              <div style={{ fontSize:10, fontWeight:700, color:"#1e293b", lineHeight:1.3, paddingRight:14, marginTop:2 }}>{st.name}</div>
                              <div style={{ fontSize:9, color:"#64748b", marginTop:2 }}>GCC {st.gcc_no}</div>
                              <div style={{ fontSize:8.5, color:"#94A3B8" }}>{st.class_name||st.course}</div>
                              <div title="Click to remove" style={{ position:"absolute", top:3, left:5, fontSize:9, color:"#FCA5A5", cursor:"pointer" }}>✕</div>
                            </>
                          ) : (
                            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"#E5E7EB", fontSize:10, paddingTop:8 }}>Drop here</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display:"flex", gap:14, marginTop:10, fontSize:12, color:"#64748b" }}>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:12, height:12, borderRadius:3, background:"#F0FDF4", border:"1.5px solid #86EFAC" }} /> Assigned</div>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:12, height:12, borderRadius:3, background:"#F9FAFB", border:"1.5px dashed #D1D5DB" }} /> Vacant</div>
            {!isMobile && <span style={{ color:"#94A3B8" }}>Drag students · Click to remove</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── REPORT_CARD_CSS ─────────────────────────────────────────────────────────
const REPORT_CARD_CSS = `
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
@page{margin:0.7cm;size:A4;}
body{font-family:'DM Sans',sans-serif;background:#d6cfc0;padding:20px;-webkit-print-color-adjust:exact;print-color-adjust:exact;}
.no-print{text-align:center;margin-bottom:16px;display:flex;gap:10px;justify-content:center;}
.no-print button{padding:10px 28px;border:none;border-radius:8px;cursor:pointer;font-family:'DM Sans',sans-serif;font-size:14px;font-weight:600;}
.btn-print{background:#1a3c2e;color:white;}.btn-close{background:#e5e7eb;color:#374151;}
.page-break{page-break-after:always;height:0;overflow:hidden;}
.card{width:720px;margin:0 auto 24px;background:#FDFAF3;border-radius:3px;box-shadow:0 12px 48px rgba(0,0,0,0.22),0 0 0 1px #D5C89A;position:relative;overflow:hidden;}
.top-strip{height:5px;background:linear-gradient(90deg,#1a3c2e 0%,#2A5C45 30%,#B8860B 60%,#f0c040 80%,#2A5C45 100%);}
.header{background:linear-gradient(150deg,#0d2818 0%,#1a3c2e 45%,#1e4d36 100%);padding:22px 32px 18px;display:flex;align-items:center;gap:16px;}
.logo-ring{width:64px;height:64px;border-radius:50%;border:2px solid #D4A017;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.logo-text{font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:#f0c040;}
.header-center{flex:1;text-align:center;}
.eyebrow{font-size:9px;letter-spacing:4px;text-transform:uppercase;color:rgba(240,192,64,0.7);margin-bottom:5px;}
.inst-name{font-family:'Playfair Display',serif;font-size:20px;font-weight:600;color:white;margin-bottom:3px;}
.inst-addr{font-size:11px;color:rgba(255,255,255,0.65);}
.doc-badge{text-align:center;flex-shrink:0;}
.doc-badge-title{font-family:'Playfair Display',serif;font-size:14px;font-weight:700;color:#f0c040;letter-spacing:2px;line-height:1.2;}
.doc-badge-sub{font-size:10px;color:rgba(255,255,255,0.6);margin-top:3px;}
.exam-result-bar{background:#1a3c2e;padding:10px 24px;display:flex;justify-content:space-between;align-items:center;}
.exam-info{display:flex;gap:20px;flex-wrap:wrap;}
.exam-info-item{display:flex;flex-direction:column;}
.exam-info-label{font-size:8px;letter-spacing:2px;text-transform:uppercase;color:rgba(240,192,64,0.6);margin-bottom:2px;}
.exam-info-value{font-size:13px;font-weight:600;color:white;}
.result-pill-bar{display:flex;align-items:center;gap:8px;}
.student-section{padding:14px 24px 10px;}
.section-title{font-family:'Cormorant Garamond',serif;font-size:13px;font-weight:600;color:#1a3c2e;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;}
.student-table{width:100%;border-collapse:collapse;font-size:13px;}
.student-table td{padding:7px 10px;border:1px solid #E5DFC8;}
.student-table .lbl{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#B8860B;font-weight:600;background:#FDFAF3;width:120px;}
.student-table .val{font-weight:600;color:#0A1628;}
.student-table .val.big{font-family:'Playfair Display',serif;font-size:16px;color:#1a3c2e;}
.score-grid{display:grid;grid-template-columns:repeat(5,1fr);background:#1a3c2e;margin:0 16px 0;border-radius:6px;overflow:hidden;}
.score-cell{text-align:center;padding:12px 8px;border-right:1px solid rgba(255,255,255,0.1);}
.score-cell:last-child{border-right:none;}
.score-lbl{font-size:8px;letter-spacing:2px;text-transform:uppercase;color:rgba(240,192,64,0.6);margin-bottom:4px;}
.score-val{font-family:'Playfair Display',serif;font-size:22px;font-weight:600;color:white;line-height:1;}
.score-val.gold{color:#f0c040;}
.score-sub{font-size:10px;color:rgba(255,255,255,0.5);margin-top:2px;}
.marks-section{padding:14px 24px;}
.marks-table{width:100%;border-collapse:collapse;font-size:12.5px;border:1px solid #E5DFC8;border-radius:6px;overflow:hidden;}
.marks-table thead tr{background:#f5f0e8;}
.marks-table thead th{padding:8px 10px;text-align:center;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#5C5440;font-weight:700;border-bottom:2px solid #D5C89A;}
.marks-table tbody td{padding:9px 10px;text-align:center;border-bottom:1px solid #EDE8D8;}
.marks-table tfoot tr{background:#f5f0e8;}
.marks-table tfoot td{padding:10px;border-top:2px solid #D5C89A;text-align:center;font-weight:700;}
.remark-box{margin:0 24px 14px;padding:12px 16px;background:white;border:1px solid #D5C89A;border-left:4px solid #B8860B;border-radius:4px;}
.remark-label{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#B8860B;font-weight:700;margin-bottom:5px;}
.remark-text{font-family:'Cormorant Garamond',serif;font-size:14px;font-style:italic;color:#5C5440;line-height:1.6;}
.sig-section{display:flex;align-items:flex-end;justify-content:space-between;padding:14px 24px 18px;background:white;border-top:1px solid #EDE8D8;gap:16px;}
.sig-block{text-align:center;flex:1;}
.sig-space{height:40px;}
.sig-label{border-top:1.5px solid #1C1A16;padding-top:5px;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#5C5440;font-weight:600;margin:0 10px;}
.seal-block{flex:0 0 70px;display:flex;flex-direction:column;align-items:center;}
.seal{width:64px;height:64px;border-radius:50%;border:2px dashed #B8860B;background:#FDFAF3;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;}
.seal-word{font-size:7px;letter-spacing:2px;text-transform:uppercase;color:#B8860B;font-weight:700;}
.seal-star{font-size:14px;color:#B8860B;line-height:1;}
.footer-strip{background:linear-gradient(90deg,#0d2818,#1a3c2e,#0d2818);padding:8px 32px;}
.footer-text{font-size:10px;color:rgba(255,255,255,0.5);text-align:center;}
.bottom-strip{height:4px;background:linear-gradient(90deg,#B8860B,#f0c040,#B8860B);}
@media print{body{background:white;padding:0;}.no-print{display:none!important;}.card{box-shadow:none;border-radius:0;width:100%;margin:0;}}
`;

// ─── buildReportCardHTML ──────────────────────────────────────────────────────
function buildReportCardHTML(st, subjects, marksMap, course, allStudents, examName, examDate, institute, remarkText) {
  const courseMax = getCourseMax(course);
  const getTotal = sid => subjects.reduce((s,sub)=>s+(Number(marksMap[`${sid}-${sub}`])||0),0);
  const total = getTotal(st.id);
  const pct = calcPct(total, course);
  const grade = getGrade(pct);
  const passed = pct >= 40;
  const gradeColors = {"A+":"#0F6E56","A":"#1B4F8A","B+":"#534AB7","B":"#2563eb","C":"#BA7517","D":"#ea580c","F":"#C0392B"};
  const gradeColor = gradeColors[grade.label]||"#0A1628";

  const sortedStudents = [...allStudents].map(s=>({...s,total:getTotal(s.id)})).sort((a,b)=>b.total-a.total);
  let rank=1,prev=null;
  for(let i=0;i<sortedStudents.length;i++){
    if(i===0){rank=1;prev=sortedStudents[i].total;}else if(sortedStudents[i].total!==prev){rank++;prev=sortedStudents[i].total;}
    if(sortedStudents[i].id===st.id)break;
  }
  const rankSuffix=rank===1?"st":rank===2?"nd":rank===3?"rd":"th";

  const subjectRows = subjects.map((s,idx)=>{
    const m=Number(marksMap[`${st.id}-${s}`])||0;
    const subMax=getSubjectMax(course,s);
    const subPct=Math.round((m/subMax)*100);
    const subPassed=subPct>=40;
    const barColor=subPct>=80?"#0F6E56":subPct>=60?"#1B4F8A":subPct>=40?"#BA7517":"#C0392B";
    const gradeLbl=subPct>=90?"A+":subPct>=80?"A":subPct>=70?"B+":subPct>=60?"B":subPct>=50?"C":subPct>=40?"D":"F";
    return `<tr>
      <td style="text-align:left;font-weight:600;color:#2D3748">${idx+1}. ${s}</td>
      <td>${subMax}</td>
      <td style="font-family:'EB Garamond',serif;font-size:14px;font-weight:700;color:#0A1628">${m}</td>
      <td><div style="display:flex;align-items:center;gap:5px;"><div style="flex:1;height:6px;background:#E2E8F0;border-radius:3px;overflow:hidden;"><div style="width:${subPct}%;height:100%;background:${barColor};border-radius:3px;"></div></div><span style="font-size:10px;font-weight:700;color:${barColor};min-width:32px">${subPct}%</span></div></td>
      <td><span style="display:inline-block;padding:1px 8px;border-radius:2px;font-size:11px;font-weight:700;color:${barColor};border:1px solid ${barColor};background:${barColor}18">${gradeLbl}</span></td>
      <td><span style="font-size:10px;font-weight:700;color:${subPassed?"#0F6E56":"#C0392B"}">${subPassed?"✓ PASS":"✗ FAIL"}</span></td>
    </tr>`;
  }).join("");

  const remarkBlock = remarkText
    ? `<div class="remark-box"><div class="remark-label">✦ Teacher's Remarks</div><div class="remark-text">"${remarkText}"</div></div>`
    : "";

  return `<div class="card">
    <div class="top-strip"></div>
    <div class="header">
      <div class="logo-ring">${institute.logoUrl?`<img src="${institute.logoUrl}" style="width:100%;height:100%;object-fit:contain;border-radius:50%"/>`:`<div class="logo-text">GNSI</div>`}</div>
      <div class="header-center">
        <div class="eyebrow">Official Academic Record · ${institute.academicYear||"2025-2026"}</div>
        <div class="inst-name">${institute.name||"Guidance Navodaya & Sainik Institute"}</div>
        <div class="inst-addr">${institute.address||"Khangabok, Thoubal, Manipur"}</div>
      </div>
      <div class="doc-badge"><div class="doc-badge-title">REPORT<br/>CARD</div><div class="doc-badge-sub">${examName}</div></div>
    </div>
    <div class="exam-result-bar">
      <div class="exam-info">
        <div class="exam-info-item"><span class="exam-info-label">Examination</span><span class="exam-info-value">${examName}</span></div>
        <div class="exam-info-item"><span class="exam-info-label">Date</span><span class="exam-info-value">${examDate||"—"}</span></div>
        <div class="exam-info-item"><span class="exam-info-label">Academic Year</span><span class="exam-info-value">${institute.academicYear||"2025-2026"}</span></div>
        <div class="exam-info-item"><span class="exam-info-label">Class Rank</span><span class="exam-info-value" style="color:${rank<=3?"#f0c040":"white"}">${rank}<sup style="font-size:10px">${rankSuffix}</sup> / ${allStudents.length}</span></div>
      </div>
      <div class="result-pill-bar">
        <span style="font-size:20px;font-weight:700;color:${gradeColor}">${grade.label}</span>
        <span style="font-size:10px;font-weight:700;letter-spacing:1px;padding:3px 8px;border-radius:2px;background:${passed?"#E1F5EE":"#FCEBEB"};color:${passed?"#0F6E56":"#C0392B"};border:1px solid ${passed?"#BBF7D0":"#FECACA"}">${passed?"PASS":"FAIL"}</span>
      </div>
    </div>
    <div class="student-section">
      <div class="section-title">Candidate Details</div>
      <table class="student-table">
        <tr><td class="lbl">Student Name</td><td class="val big" colspan="3">${st.name}</td></tr>
        <tr><td class="lbl">GCC / Roll No.</td><td class="val big" style="letter-spacing:3px">${String(st.gcc_no||"").padStart(6,"0")}</td><td class="lbl">Admission No.</td><td class="val">${st.admission_no||"—"}</td></tr>
        <tr><td class="lbl">Course</td><td class="val">${st.course||course}</td><td class="lbl">Batch</td><td class="val">${st.class_name||"—"}</td></tr>
      </table>
    </div>
    <div class="score-grid" style="margin:0 16px;">
      <div class="score-cell"><div class="score-lbl">Marks Obtained</div><div class="score-val">${total}<span style="font-size:11px;opacity:.5">/${courseMax}</span></div></div>
      <div class="score-cell"><div class="score-lbl">Percentage</div><div class="score-val gold">${pct.toFixed(1)}%</div></div>
      <div class="score-cell"><div class="score-lbl">Grade</div><div class="score-val" style="color:${gradeColor}">${grade.label}</div><div class="score-sub">${grade.gpa.toFixed(1)} GPA</div></div>
      <div class="score-cell"><div class="score-lbl">Subjects</div><div class="score-val">${subjects.length}</div></div>
      <div class="score-cell"><div class="score-lbl">Class Rank</div><div class="score-val" style="color:${rank<=3?"#f0c040":"white"}">${rank}<sup style="font-size:11px">${rankSuffix}</sup></div><div class="score-sub">of ${allStudents.length}</div></div>
    </div>
    <div class="marks-section">
      <div class="section-title" style="margin-top:8px">Subject-wise Performance</div>
      <table class="marks-table">
        <thead><tr><th style="text-align:left;width:32%">Subject</th><th>Max Marks</th><th>Marks Obtained</th><th style="width:25%">Performance</th><th>Grade</th><th>Result</th></tr></thead>
        <tbody>${subjectRows}</tbody>
        <tfoot><tr>
          <td style="text-align:left;font-size:12px;font-weight:700">Grand Total</td>
          <td>${courseMax}</td>
          <td style="font-size:16px;font-weight:700;color:#0A1628">${total}</td>
          <td><div style="display:flex;align-items:center;gap:5px;"><div style="flex:1;height:7px;background:#E2E8F0;border-radius:3px;overflow:hidden;"><div style="width:${pct}%;height:100%;background:${gradeColor};border-radius:3px;"></div></div><span style="font-size:11px;font-weight:700;color:${gradeColor}">${pct.toFixed(1)}%</span></div></td>
          <td><span style="display:inline-block;padding:2px 9px;border-radius:2px;font-size:12px;font-weight:700;color:${gradeColor};border:1px solid ${gradeColor};background:${gradeColor}18">${grade.label}</span></td>
          <td><span style="font-size:11px;font-weight:700;color:${passed?"#0F6E56":"#C0392B"}">${passed?"✓ PASS":"✗ FAIL"}</span></td>
        </tr></tfoot>
      </table>
    </div>
    ${remarkBlock}
    <div class="sig-section">
      <div class="sig-block"><div class="sig-space"></div><div class="sig-label">Student's Signature</div></div>
      <div class="seal-block"><div class="seal"><div class="seal-word">Official</div><div class="seal-star">★</div><div class="seal-word">Seal</div></div></div>
      <div class="sig-block"><div class="sig-space"></div><div class="sig-label">Class Teacher</div></div>
      <div class="sig-block"><div class="sig-space"></div><div class="sig-label">Head of Institute</div></div>
    </div>
    <div class="footer-strip"><div class="footer-text">${institute.name||"GNSI"} · ${institute.address||"Khangabok, Manipur"} · ${examName} · Academic Year ${institute.academicYear||"2025-2026"}</div></div>
    <div class="bottom-strip"></div>
  </div>`;
}

// ─── REPORT CARD ITEM ─────────────────────────────────────────────────────────
function ReportCardItem({ st, subjects, marks, examType, examDate, examName, institute, allStudents, course }) {
  const { remark, setRemark, save: saveRemark, saving: savingRemark, saved: savedRemark } = useRemarks(st.id, examType, examDate);
  const courseMax = getCourseMax(course);
  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);
  const total = getTotal(st.id);
  const pct = calcPct(total, course);
  const grade = getGrade(pct);

  const printReport = () => {
    const sortedStudents = [...allStudents].map(s => ({ ...s, total: getTotal(s.id) })).sort((a, b) => b.total - a.total);
    let rank = 1, prev = null;
    for (let i = 0; i < sortedStudents.length; i++) {
      if (i === 0) { rank = 1; prev = sortedStudents[i].total; } else if (sortedStudents[i].total !== prev) { rank++; prev = sortedStudents[i].total; }
      if (sortedStudents[i].id === st.id) break;
    }
    const html = buildReportCardHTML(st, subjects, marks, course, allStudents, examName, examDate, institute, remark);
    const w = window.open("", "_blank");
    w.document.write(`<!DOCTYPE html><html><head>
    <title>Report Card — ${st.name}</title>
    <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&family=EB+Garamond:wght@400;500;600&display=swap" rel="stylesheet"/>
    <style>${REPORT_CARD_CSS}</style></head><body>
    <div class="no-print"><button class="btn-print" onclick="window.print()">🖨️ Print / Save as PDF</button><button class="btn-close" onclick="window.close()">✕ Close</button></div>
    ${html}</body></html>`);
    w.document.close();
  };

  return (
    <div style={{ ...css.card, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${grade.color},${grade.bg})` }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div><div style={{ fontWeight: 700, fontSize: 15 }}>{st.name}</div><div style={{ fontSize: 11, color: "#9CA3AF" }}>GCC {st.gcc_no} · {st.class_name}</div></div>
        <Badge label={grade.label} color={grade.color} bg={grade.bg} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div style={{ textAlign: "center", padding: 8, background: "#F9FAFB", borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1 }}>Total</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 600 }}>{total}<span style={{ fontSize: 11, color: "#9CA3AF" }}>/{courseMax}</span></div>
        </div>
        <div style={{ textAlign: "center", padding: 8, background: "#F9FAFB", borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 1 }}>Percentage</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 600, color: grade.color }}>{pct.toFixed(1)}%</div>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4, textTransform: "uppercase" }}>Teacher's Remarks</label>
        <textarea value={remark} onChange={e => setRemark(e.target.value)} placeholder="Optional remark…"
          style={{ width: "100%", minHeight: 54, border: "1px solid #D1D5DB", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontFamily: "'DM Sans',sans-serif", resize: "vertical", outline: "none" }} />
        <button onClick={() => saveRemark(remark)} style={{ ...css.btn, padding: "5px 12px", fontSize: 12, marginTop: 5, background: savedRemark ? "#E1F5EE" : "#EFF6FF", color: savedRemark ? "#0F6E56" : "#1D4ED8", border: "1px solid " + (savedRemark ? "#BBF7D0" : "#BFDBFE") }}>
          {savingRemark ? "Saving…" : savedRemark ? "✓ Saved" : "💾 Save Remark"}
        </button>
      </div>
      {(() => {
        const [printing, setPrinting] = React.useState(false);
        return <button onClick={() => { setPrinting(true); printReport(); setTimeout(() => setPrinting(false), 3000); }} disabled={printing}
          style={{ ...css.btn, background: printing ? "#6B7280" : "#1a3c2e", color: "white", width: "100%" }}>
          {printing ? "⏳ Opening…" : "🖨️ Print Report Card"}
        </button>;
      })()}
    </div>
  );
}

// ─── REPORT CARDS TAB ─────────────────────────────────────────────────────────
function ReportCards({ courseSubjects, examTypes, students, institute }) {
  const isMobile = useMobile();
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const subjects = courseSubjects[course] || [];
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course || (s.course || "").toUpperCase() === course
  );
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState("");
  const [marks, setMarks] = useState({});
  const [dates, setDates] = useState([]);

  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]);
    });
  }, [examType]);

  useEffect(() => {
    if (!examType || !examDate) return;
    const ids = courseStudents.map(s => s.id);
    supabase.from("exam_marks").select("*").eq("exam_type_id", examType).eq("exam_date", examDate).in("student_id", ids.length ? ids : ["__none__"]).then(({ data }) => {
      const map = {}; (data || []).forEach(r => { map[`${r.student_id}-${r.subject}`] = r.marks; }); setMarks(map);
    });
  }, [examType, examDate, course]);

  const examName = examTypes.find(e => e.id === examType)?.name || "Examination";
  return (
    <div>
      <div style={{ ...css.card, background: "#F8FAFC", marginBottom: 14 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setMarks({}); }} />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 200 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select>
        </div>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Date</label>
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 160 }}>{dates.map(d => <option key={d} value={d}>{d}</option>)}</select>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
        {courseStudents.map(st => (
          <ReportCardItem key={st.id} st={st} subjects={subjects} marks={marks} examType={examType} examDate={examDate} examName={examName} institute={institute} allStudents={courseStudents} course={course} />
        ))}
      </div>
    </div>
  );
}

// ─── BULK REPORTS (mobile: stacked) ──────────────────────────────────────────
function BulkReports({ courseSubjects, examTypes, students, institute, schedule }) {
  const isMobile = useMobile();
  const courses = Object.keys(courseSubjects);
  const [activeSection, setActiveSection] = useState("reportcard");

  const [rcCourse, setRcCourse]       = useState(courses[0] || "");
  const [rcExamType, setRcExamType]   = useState(examTypes[0]?.id || "");
  const [rcExamDate, setRcExamDate]   = useState("");
  const [rcDates, setRcDates]         = useState([]);
  const [rcMarks, setRcMarks]         = useState({});
  const [rcRemarks, setRcRemarks]     = useState({});
  const [rcLoading, setRcLoading]     = useState(false);
  const [rcProgress, setRcProgress]   = useState(null);
  const [rcFilter, setRcFilter]       = useState("all");
  const [rcTopN, setRcTopN]           = useState(10);
  const [rcSearch, setRcSearch]       = useState("");
  const [rcSortBy, setRcSortBy]       = useState("name");
  const [rcIncludeRemarks, setRcIncludeRemarks] = useState(true);
  const [rcPageBreak, setRcPageBreak] = useState(true);

  const [acCourse, setAcCourse]       = useState(courses[0] || "");
  const [acExamType, setAcExamType]   = useState(examTypes[0]?.id || "");
  const [acSearch, setAcSearch]       = useState("");
  const [acSortBy, setAcSortBy]       = useState("name");
  const [acProgress, setAcProgress]   = useState(null);

  const rcSubjects = courseSubjects[rcCourse] || [];
  const rcStudents = students.filter(s => (s.class_name||"").toUpperCase()===rcCourse||(s.course||"").toUpperCase()===rcCourse);
  const acStudents = students.filter(s => (s.class_name||"").toUpperCase()===acCourse||(s.course||"").toUpperCase()===acCourse);
  const acSchedule = schedule.filter(s => s.exam_type_id === acExamType && (!s.course || s.course.toUpperCase() === acCourse.toUpperCase()));
  const acExamName = examTypes.find(e=>e.id===acExamType)?.name||"Examination";

  useEffect(() => {
    if (!rcExamType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", rcExamType).then(({ data }) => {
      const unique = [...new Set((data||[]).map(r=>r.exam_date))].sort().reverse();
      setRcDates(unique); if (unique.length) setRcExamDate(unique[0]);
    });
  }, [rcExamType]);

  useEffect(() => {
    if (!rcExamType || !rcExamDate) return;
    setRcLoading(true);
    const ids = rcStudents.map(s=>s.id);
    supabase.from("exam_marks").select("*").eq("exam_type_id", rcExamType).eq("exam_date", rcExamDate).in("student_id", ids.length?ids:["__none__"]).then(({ data }) => {
      const map = {}; (data||[]).forEach(r=>{ map[`${r.student_id}-${r.subject}`]=r.marks; });
      setRcMarks(map); setRcLoading(false);
    });
  }, [rcExamType, rcExamDate, rcCourse]);

  useEffect(() => {
    if (!rcExamType || !rcExamDate || !rcStudents.length) return;
    const ids = rcStudents.map(s=>s.id);
    supabase.from("exam_remarks").select("*").eq("exam_type_id", rcExamType).eq("exam_date", rcExamDate).in("student_id", ids).then(({ data }) => {
      const map = {}; (data||[]).forEach(r=>{ map[r.student_id]=r.remark; });
      setRcRemarks(map);
    });
  }, [rcExamType, rcExamDate, rcCourse]);

  const getTotal = (sid) => rcSubjects.reduce((s,sub)=>s+(Number(rcMarks[`${sid}-${sub}`])||0),0);
  const getPct   = (sid) => calcPct(getTotal(sid), rcCourse);

  const sortedRcStudents = [...rcStudents].sort((a,b)=>{
    if (rcSortBy==="rank") return getTotal(b.id)-getTotal(a.id);
    if (rcSortBy==="gcc")  return Number(a.gcc_no)-Number(b.gcc_no);
    return a.name.localeCompare(b.name);
  });
  const filteredRcStudents = sortedRcStudents.filter(s=>{
    const pct = getPct(s.id);
    const search = !rcSearch || s.name.toLowerCase().includes(rcSearch.toLowerCase()) || String(s.gcc_no).includes(rcSearch);
    if (!search) return false;
    if (rcFilter==="pass") return pct>=40;
    if (rcFilter==="fail") return pct<40;
    return true;
  }).slice(0, rcFilter==="topN" ? rcTopN : undefined);

  const sortedAcStudents = [...acStudents].sort((a,b)=>{
    if (acSortBy==="gcc") return Number(a.gcc_no)-Number(b.gcc_no);
    return a.name.localeCompare(b.name);
  });
  const filteredAcStudents = sortedAcStudents.filter(s=>!acSearch || s.name.toLowerCase().includes(acSearch.toLowerCase()) || String(s.gcc_no).includes(acSearch));

  const printAllReportCards = async () => {
    if (!filteredRcStudents.length) return;
    const w = window.open("", "_blank");
    if (!w) { alert("⚠️ Popup blocked! Please allow popups for this site."); return; }
    w.document.write(`<!DOCTYPE html><html><head><style>body{font-family:sans-serif;background:#1a3c2e;display:flex;align-items:center;justify-content:center;min-height:100vh;color:white;font-size:18px;}</style></head><body>⏳ Preparing ${filteredRcStudents.length} report cards…</body></html>`);
    setRcProgress({ current: 0, total: filteredRcStudents.length });
    try { await supabase.from('exam_print_log').insert({ doc_type:'report_card', course:rcCourse, exam_type:examTypes.find(e=>e.id===rcExamType)?.name||'', student_count:filteredRcStudents.length }); } catch(_) {}
    const cards = [];
    for (let i = 0; i < filteredRcStudents.length; i++) {
      const st = filteredRcStudents[i];
      const remark = rcIncludeRemarks ? (rcRemarks[st.id] || "") : "";
      cards.push(buildReportCardHTML(st, rcSubjects, rcMarks, rcCourse, rcStudents, examTypes.find(e=>e.id===rcExamType)?.name||"Examination", rcExamDate, institute, remark));
      setRcProgress({ current: i+1, total: filteredRcStudents.length });
      await new Promise(r => setTimeout(r, 0));
    }
    const sep = rcPageBreak ? '<div class="page-break"></div>' : '<div style="margin-bottom:24px"></div>';
    w.document.open();
    w.document.write(`<!DOCTYPE html><html><head>
      <title>Bulk Report Cards — ${rcCourse}</title>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,400&family=DM+Sans:wght@300;400;500;600&family=EB+Garamond:wght@400;500;600&display=swap" rel="stylesheet"/>
      <style>${REPORT_CARD_CSS}</style></head><body>
      <div class="no-print">
        <button class="btn-print" onclick="document.fonts.ready.then(()=>{setTimeout(()=>window.print(),400)});">🖨️ Print All (${cards.length}) Report Cards</button>
        <button class="btn-close" onclick="window.close()">✕ Close</button>
      </div>
      ${cards.join(sep)}</body></html>`);
    w.document.close();
    setRcProgress(null);
  };

  const buildAdmitCardHTML = (st) => generateAdmitCardHTML(st, { examTypeName: acExamName, examSchedule: acSchedule, institute, course: acCourse });

  const printAllAdmitCards = async () => {
    if (!filteredAcStudents.length) return;
    const w = window.open("", "_blank");
    if (!w) { alert("⚠️ Popup blocked! Please allow popups for this site."); return; }
    w.document.write(`<!DOCTYPE html><html><head><style>body{font-family:sans-serif;background:#1a3c2e;display:flex;align-items:center;justify-content:center;min-height:100vh;color:white;font-size:18px;}</style></head><body>⏳ Preparing ${filteredAcStudents.length} admit cards…</body></html>`);
    setAcProgress({ current: 0, total: filteredAcStudents.length });
    try { await supabase.from('exam_print_log').insert({ doc_type:'admit_card', course:acCourse, exam_type:acExamName, student_count:filteredAcStudents.length }); } catch(_) {}
    const cards = [];
    for (let i = 0; i < filteredAcStudents.length; i++) {
      cards.push(buildAdmitCardHTML(filteredAcStudents[i]));
      setAcProgress({ current: i+1, total: filteredAcStudents.length });
      await new Promise(r => setTimeout(r, 0));
    }
    w.document.open();
    w.document.write(`<!DOCTYPE html><html><head>
      <title>Bulk Admit Cards — ${acCourse}</title>
      <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=EB+Garamond:wght@400;500;600&display=swap" rel="stylesheet"/>
      <style>${ADMIT_CARD_CSS}</style></head><body>
      <div class="no-print">
        <button class="btn-print" onclick="document.fonts.ready.then(()=>{setTimeout(()=>window.print(),400)});">🖨️ Print All (${cards.length}) Admit Cards</button>
        <button class="btn-close" onclick="window.close()">✕ Close</button>
      </div>
      ${cards.join('<div class="page-break"></div>')}</body></html>`);
    w.document.close();
    setAcProgress(null);
  };

  const SectionBtn = ({ id, icon, label, count }) => (
    <button onClick={() => setActiveSection(id)}
      style={{ display:"flex", alignItems:"center", gap:10, padding: isMobile ? "12px 14px" : "14px 24px", borderRadius:10, border: activeSection===id ? "2px solid #1a3c2e" : "2px solid #E5E7EB", background: activeSection===id ? "#1a3c2e" : "white", color: activeSection===id ? "white" : "#374151", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize: isMobile ? 13 : 14, flex:1, transition:"all .15s" }}>
      <span style={{ fontSize: isMobile ? 18 : 22 }}>{icon}</span>
      <div style={{ textAlign:"left" }}>
        <div>{label}</div>
        <div style={{ fontSize:11, fontWeight:400, opacity:0.7 }}>{count} students</div>
      </div>
    </button>
  );

  const StatPill = ({ label, value, color }) => (
    <div style={{ background:"white", borderRadius:8, padding:"10px 14px", boxShadow:"0 1px 4px rgba(0,0,0,0.06)", borderLeft:`3px solid ${color||"#1a3c2e"}` }}>
      <div style={{ fontSize:10, fontWeight:700, color:"#6B7280", textTransform:"uppercase", letterSpacing:".08em", marginBottom:3 }}>{label}</div>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:600, color:color||"#1a3c2e" }}>{value}</div>
    </div>
  );

  // Responsive two-col
  const twoCols = { display: isMobile ? "flex" : "grid", flexDirection: "column", gridTemplateColumns: "300px 1fr", gap: isMobile ? 14 : 20 };

  return (
    <div>
      <div style={{ display:"flex", gap:12, marginBottom:20 }}>
        <SectionBtn id="reportcard" icon="📋" label="Bulk Report Cards" count={rcStudents.length} />
        <SectionBtn id="admitcard"  icon="🪪"  label="Bulk Admit Cards"  count={acStudents.length} />
      </div>

      {activeSection === "reportcard" && (
        <div style={twoCols}>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", overflow:"hidden" }}>
              <div style={{ padding:"12px 18px", background:"#1a3c2e", color:"white", fontWeight:700, fontSize:13 }}>⚙️ Report Card Settings</div>
              <div style={{ padding:18, display:"flex", flexDirection:"column", gap:14 }}>
                <div>
                  <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:6, textTransform:"uppercase" }}>Batch / Course</label>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                    {courses.map(c => <button key={c} onClick={()=>setRcCourse(c)} style={{ ...css.btn, padding:"4px 10px", fontSize:11, background:rcCourse===c?"#1a3c2e":"#F3F4F6", color:rcCourse===c?"white":"#374151", border:rcCourse===c?"none":"1px solid #E5E7EB" }}>{c}</button>)}
                  </div>
                </div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:5, textTransform:"uppercase" }}>Exam Type</label>
                  <select value={rcExamType} onChange={e=>setRcExamType(e.target.value)} style={css.input}>{examTypes.map(et=><option key={et.id} value={et.id}>{et.name}</option>)}</select></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:5, textTransform:"uppercase" }}>Date</label>
                  <select value={rcExamDate} onChange={e=>setRcExamDate(e.target.value)} style={css.input}>{rcDates.map(d=><option key={d} value={d}>{d}</option>)}</select></div>
                <div style={{ height:1, background:"#F1F5F9" }} />
                <div>
                  <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:6, textTransform:"uppercase" }}>Filter Students</label>
                  <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                    {[["all","All Students"],["pass","Passed Only"],["fail","Failed Only"],["topN","Top N"]].map(([val,lbl])=>(
                      <label key={val} style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, cursor:"pointer" }}>
                        <input type="radio" checked={rcFilter===val} onChange={()=>setRcFilter(val)} />{lbl}
                      </label>
                    ))}
                    {rcFilter==="topN" && <input type="number" value={rcTopN} onChange={e=>setRcTopN(Number(e.target.value))} min={1} style={{ ...css.input, width:80, marginLeft:22 }} />}
                  </div>
                </div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:6, textTransform:"uppercase" }}>Sort By</label>
                  <select value={rcSortBy} onChange={e=>setRcSortBy(e.target.value)} style={css.input}><option value="name">Name (A–Z)</option><option value="rank">Rank</option><option value="gcc">GCC No.</option></select></div>
                <div><input placeholder="Search name or GCC…" value={rcSearch} onChange={e=>setRcSearch(e.target.value)} style={css.input} /></div>
                <div style={{ height:1, background:"#F1F5F9" }} />
                <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, cursor:"pointer" }}><input type="checkbox" checked={rcIncludeRemarks} onChange={e=>setRcIncludeRemarks(e.target.checked)} />Include teacher remarks</label>
                <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, cursor:"pointer" }}><input type="checkbox" checked={rcPageBreak} onChange={e=>setRcPageBreak(e.target.checked)} />Page break between cards</label>
              </div>
            </div>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap:10 }}>
              <StatPill label="Total"   value={rcStudents.length}          color="#1a3c2e" />
              <StatPill label="Will Print" value={filteredRcStudents.length}  color="#185FA5" />
              <StatPill label="Passed"  value={rcStudents.filter(s=>getPct(s.id)>=40).length} color="#0F6E56" />
              <StatPill label="Failed"  value={rcStudents.filter(s=>getPct(s.id)<40 && getTotal(s.id)>0).length} color="#A32D2D" />
            </div>
            <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", padding:18 }}>
              {rcProgress ? (
                <div style={{ textAlign:"center", padding:"20px 0" }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"#1a3c2e", marginBottom:12 }}>⏳ Generating {rcProgress.current}/{rcProgress.total} cards…</div>
                  <div style={{ height:8, background:"#F1F5F9", borderRadius:999, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${(rcProgress.current/rcProgress.total)*100}%`, background:"#1a3c2e", borderRadius:999, transition:"width .2s" }} />
                  </div>
                </div>
              ) : (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:14, flexWrap:"wrap" }}>
                  <div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:600, color:"#1e293b", marginBottom:4 }}>Ready to print {filteredRcStudents.length} report cards</div>
                    <div style={{ fontSize:12, color:"#9CA3AF" }}>{rcCourse} · {examTypes.find(e=>e.id===rcExamType)?.name} · {rcExamDate}</div>
                  </div>
                  <button onClick={printAllReportCards} disabled={!filteredRcStudents.length || rcLoading}
                    style={{ ...css.btn, background:"#1a3c2e", color:"white", padding:"12px 24px", fontSize:13, whiteSpace:"nowrap" }}>
                    🖨️ Print All {filteredRcStudents.length}
                  </button>
                </div>
              )}
            </div>
            <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", overflow:"hidden" }}>
              <div style={{ padding:"12px 18px", background:"#1a3c2e", color:"white", fontWeight:700, fontSize:13, display:"flex", justifyContent:"space-between" }}>
                <span>📋 Print Queue</span><span style={{ opacity:0.7, fontSize:12 }}>{filteredRcStudents.length} cards</span>
              </div>
              <div style={{ maxHeight:320, overflowY:"auto", overflowX:"auto" }}>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth: isMobile ? 380 : "auto" }}>
                  <thead style={{ position:"sticky", top:0 }}>
                    <tr style={{ background:"#F8FAFC", borderBottom:"2px solid #E5E7EB" }}>
                      {["#","GCC","Student","Total","%","Grade"].map(h=><th key={h} style={{ padding:"9px 10px", textAlign:h==="Student"?"left":"center", fontWeight:700, color:"#374151", fontSize:11 }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRcStudents.map((st,i)=>{
                      const total=getTotal(st.id); const pct=getPct(st.id); const g=getGrade(pct);
                      return <tr key={st.id} style={{ background:i%2?"#F9FAFB":"white", borderBottom:"1px solid #F1F5F9" }}>
                        <td style={{ padding:"8px 10px", textAlign:"center", color:"#9CA3AF", fontSize:11 }}>{i+1}</td>
                        <td style={{ padding:"8px 10px", textAlign:"center", fontWeight:700, color:"#1a3c2e" }}>{st.gcc_no}</td>
                        <td style={{ padding:"8px 10px", fontWeight:600 }}>{st.name}</td>
                        <td style={{ padding:"8px 10px", textAlign:"center", fontWeight:700 }}>{total}/{getCourseMax(rcCourse)}</td>
                        <td style={{ padding:"8px 10px", textAlign:"center", fontWeight:700, color:g.color }}>{pct.toFixed(1)}%</td>
                        <td style={{ padding:"8px 10px", textAlign:"center" }}><Badge label={g.label} color={g.color} bg={g.bg} /></td>
                      </tr>;
                    })}
                    {!filteredRcStudents.length && <tr><td colSpan={6} style={{ padding:32, textAlign:"center", color:"#94A3B8" }}>No students match filter.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeSection === "admitcard" && (
        <div style={twoCols}>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", overflow:"hidden" }}>
              <div style={{ padding:"12px 18px", background:"#1a3c2e", color:"white", fontWeight:700, fontSize:13 }}>⚙️ Admit Card Settings</div>
              <div style={{ padding:18, display:"flex", flexDirection:"column", gap:14 }}>
                <div>
                  <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:6, textTransform:"uppercase" }}>Batch / Course</label>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                    {courses.map(c=><button key={c} onClick={()=>setAcCourse(c)} style={{ ...css.btn, padding:"4px 10px", fontSize:11, background:acCourse===c?"#1a3c2e":"#F3F4F6", color:acCourse===c?"white":"#374151", border:acCourse===c?"none":"1px solid #E5E7EB" }}>{c}</button>)}
                  </div>
                </div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:5, textTransform:"uppercase" }}>Exam Type</label>
                  <select value={acExamType} onChange={e=>setAcExamType(e.target.value)} style={css.input}>{examTypes.map(et=><option key={et.id} value={et.id}>{et.name}</option>)}</select></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:6, textTransform:"uppercase" }}>Sort By</label>
                  <select value={acSortBy} onChange={e=>setAcSortBy(e.target.value)} style={css.input}><option value="name">Name (A–Z)</option><option value="gcc">GCC Number</option></select></div>
                <div><input placeholder="Search name or GCC…" value={acSearch} onChange={e=>setAcSearch(e.target.value)} style={css.input} /></div>
                <div style={{ background: acSchedule.length?"#E1F5EE":"#FFFBEB", border:`1px solid ${acSchedule.length?"#BBF7D0":"#FDE68A"}`, borderRadius:8, padding:"10px 14px", fontSize:12, color:acSchedule.length?"#0F6E56":"#92400E" }}>
                  {acSchedule.length ? `✅ ${acSchedule.length} schedule entries found` : "⚠️ No schedule entries. Add in Schedule tab."}
                </div>
              </div>
            </div>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              <StatPill label="Total Students" value={acStudents.length}        color="#1a3c2e" />
              <StatPill label="Will Print"     value={filteredAcStudents.length} color="#185FA5" />
              <StatPill label="Schedule Items" value={acSchedule.length}        color="#7c3aed" />
            </div>
            <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", padding:18 }}>
              {acProgress ? (
                <div style={{ textAlign:"center", padding:"20px 0" }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"#1a3c2e", marginBottom:12 }}>⏳ Generating {acProgress.current}/{acProgress.total} cards…</div>
                  <div style={{ height:8, background:"#F1F5F9", borderRadius:999, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${(acProgress.current/acProgress.total)*100}%`, background:"#1a3c2e", borderRadius:999, transition:"width .2s" }} />
                  </div>
                </div>
              ) : (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:14, flexWrap:"wrap" }}>
                  <div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:600, color:"#1e293b", marginBottom:4 }}>Ready to print {filteredAcStudents.length} admit cards</div>
                    <div style={{ fontSize:12, color:"#9CA3AF" }}>{acCourse} · {acExamName}</div>
                  </div>
                  <button onClick={printAllAdmitCards} disabled={!filteredAcStudents.length}
                    style={{ ...css.btn, background:"#1a3c2e", color:"white", padding:"12px 24px", fontSize:13, whiteSpace:"nowrap" }}>
                    🖨️ Print All {filteredAcStudents.length}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ADMIT CARDS TAB ──────────────────────────────────────────────────────────
function AdmitCardsTab({ courseSubjects, examTypes, students, institute, schedule }) {
  const isMobile = useMobile();
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [search, setSearch] = useState("");

  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course || (s.course || "").toUpperCase() === course
  );
  const filtered = courseStudents.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) || String(s.gcc_no).includes(search)
  );
  const examTypeName = examTypes.find(e => e.id === examType)?.name || "Examination";
  const examSchedule = schedule.filter(s =>
    s.exam_type_id === examType && (!s.course || s.course.toUpperCase() === course.toUpperCase())
  );

  const generateCardHTML = (st) => generateAdmitCardHTML(st, { examTypeName, examSchedule, institute, course });
  const printAll = () => openAdmitCardPrintWindow(filtered.map(st => generateCardHTML(st)), `Admit Cards — ${course} — ${examTypeName}`);
  const printOne = (st) => openAdmitCardPrintWindow([generateCardHTML(st)], `Admit Card — ${st.name}`);

  return (
    <div>
      <div style={{ ...css.card, background: "#F8FAFC", marginBottom: 14 }}>
        <CoursePicker courses={courses} value={course} onChange={setCourse} />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 220 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select>
        </div>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Search</label>
          <input placeholder="Name or GCC…" value={search} onChange={e => setSearch(e.target.value)} style={css.input} />
        </div>
        <button onClick={printAll} style={{ ...css.btn, background: "#1a3c2e", color: "white", padding: "9px 20px", fontSize: isMobile ? 12 : 14, whiteSpace: "nowrap" }}>
          🖨️ Print All ({filtered.length})
        </button>
      </div>
      {examSchedule.length === 0 && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#92400E" }}>
          ⚠️ No schedule entries for this exam type. Go to <b>Schedule</b> tab and add entries.
        </div>
      )}
      {examSchedule.length > 0 && (
        <div style={{ background: "#E1F5EE", border: "1px solid #BBF7D0", borderRadius: 8, padding: "12px 16px", marginBottom: 14, fontSize: 13, color: "#0F6E56" }}>
          ✅ {examSchedule.length} schedule entries found for <b>{examTypeName}</b>.
        </div>
      )}
      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
          <span>🪪 {course} — {examTypeName}</span>
          <span style={{ opacity: 0.7, fontSize: 12 }}>{filtered.length} students</span>
        </div>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: isMobile ? 380 : "auto" }}>
            <thead><tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
              {["GCC No.", "Student Name", "Batch", "Adm. No.", "Print"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: h === "Student Name" ? "left" : "center", fontWeight: 700, color: "#374151", fontSize: 11 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((st, i) => (
                <tr key={st.id} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "9px 12px", textAlign: "center", fontWeight: 700, color: "#1a3c2e" }}>{st.gcc_no}</td>
                  <td style={{ padding: "9px 12px", fontWeight: 600, color: "#1e293b" }}>{st.name}</td>
                  <td style={{ padding: "9px 12px", textAlign: "center" }}><span style={{ background: "#E0F2FE", color: "#0369A1", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{st.class_name || "—"}</span></td>
                  <td style={{ padding: "9px 12px", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>{st.admission_no || "—"}</td>
                  <td style={{ padding: "9px 12px", textAlign: "center" }}>
                    <button onClick={() => printOne(st)} style={{ ...css.btn, padding: "5px 12px", background: "#1a3c2e", color: "white", fontSize: 12 }}>🖨️</button>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#94A3B8" }}>No students found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── EXAM HUB HEADER ──────────────────────────────────────────────────────────
function ExamHubHeader({ institute, students, courses, examTypes, currentUser }) {
  const isMobile = useMobile();

  const stats = [
    { label: "Students",   val: students.length,              icon: "👤", color: "#60a5fa" },
    { label: "Batches",    val: courses.length,               icon: "📚", color: "#34d399" },
    { label: "Exam Types", val: examTypes.length,             icon: "📝", color: "#f0c040" },
    { label: "Role",       val: currentUser?.role || "Admin", icon: "🔑", color: "#c084fc" },
  ];

  const Badge = (
    <div style={{
      width: isMobile ? 34 : 40, height: isMobile ? 34 : 40,
      borderRadius: 9, flexShrink: 0,
      background: "linear-gradient(135deg,#1a3c2e,#2A5C45)",
      border: "1.5px solid rgba(184,134,11,0.5)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: isMobile ? 16 : 20,
    }}>🎓</div>
  );

  const Title = (
    <div style={{ display: "flex", alignItems: "baseline", gap: 5 }}>
      <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: isMobile ? 16 : 19, color: "white" }}>Exam</span>
      <span style={{ fontFamily: "'DM Sans',sans-serif", fontWeight: 700, fontSize: isMobile ? 16 : 19, color: "#f0c040" }}>HUB</span>
      {!isMobile && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", marginLeft: 4 }}>· {institute.name}</span>}
    </div>
  );

  const Chips = (
    <div style={{ display: "flex", gap: isMobile ? 6 : 8, overflowX: isMobile ? "auto" : "visible" }}>
      {stats.map(s => (
        <div key={s.label} style={{
          display: "flex", alignItems: "center",
          gap: isMobile ? 5 : 7, flexShrink: 0,
          background: "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.09)",
          borderRadius: 8,
          padding: isMobile ? "5px 10px" : "6px 14px",
        }}>
          <span style={{ fontSize: isMobile ? 11 : 13 }}>{s.icon}</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: isMobile ? 13 : 15, color: "white", lineHeight: 1 }}>{s.val}</div>
            <div style={{ fontSize: isMobile ? 9 : 9, color: s.color, textTransform: "uppercase", letterSpacing: "1px", marginTop: 2 }}>{s.label}</div>
          </div>
        </div>
      ))}
    </div>
  );

  if (isMobile) return (
    <div style={{ background: "#0d1b2a", borderBottom: "3px solid #B8860B" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px 8px" }}>
        {Badge}{Title}
      </div>
      <div style={{ padding: "0 14px 10px" }}>{Chips}</div>
    </div>
  );

  return (
    <div style={{
      background: "#0d1b2a", borderBottom: "3px solid #B8860B",
      display: "flex", alignItems: "center",
      padding: "0 28px", height: 60, gap: 16,
    }}>
      {Badge}
      {Title}
      <div style={{ flex: 1 }} />
      {Chips}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXAM CONFIG MANAGER v3 — Full Exam Format Builder
// NEW in v3:
//   • Duplicate / clone any config
//   • Edit custom configs (built-ins are read-only)
//   • Export any config as .json / Import from .json file
//   • Preview modal — admit-card-style mark sheet
//
// Paste this entire block just above the // ─── ROOT EXPORT comment
// (replaces the entire v2 block you had before)
// ═══════════════════════════════════════════════════════════════════════════

// ── Built-in preset configs ────────────────────────────────────────────────
const EXAM_CONFIG_PRESETS = [
  {
    id: "default",
    name: "Default Configuration",
    description: "Standard GNSI subject & mark scheme",
    examDate: "",
    examMode: "Written",
    sessions: [],
    courseSubjects: {
      ACHIEVER:  ["English Grammar","Vocabulary","General Knowledge","Mathematics -I","Mathematics - II","Reasoning","Science"],
      ELITE:     ["English Grammar","Science","Mathematics","Reasoning","Meitei Mayek"],
      PRIME:     ["English Grammar","Science","Mathematics","Reasoning","Meitei Mayek"],
      LAKSHYA:   ["Grammar","Mental","Mathematics","Meitei Mayek"],
      UMEED:     ["Grammar & Vocabulary","Mental","Mathematics","Meitei Mayek"],
      CHAMPION:  ["Vocabulary","General Knowledge","Mathematics-II","Mathematics - I","Reasoning","Grammar","Science"],
      LEADER:    ["Vocabulary","Grammar","General Knowledge","Mathematics -I","Mathematics - II","Reasoning","Science"],
    },
    courseMaxMarks: {
      ACHIEVER:  {"English Grammar":10,"Vocabulary":10,"General Knowledge":10,"Mathematics -I":20,"Mathematics - II":20,"Reasoning":20,"Science":10},
      ELITE:     {"English Grammar":20,"Science":15,"Mathematics":30,"Reasoning":20,"Meitei Mayek":15},
      PRIME:     {"English Grammar":20,"Science":15,"Mathematics":30,"Reasoning":20,"Meitei Mayek":15},
      LAKSHYA:   {"Grammar":20,"Mental":30,"Mathematics":30,"Meitei Mayek":20},
      UMEED:     {"Grammar & Vocabulary":20,"Mental":30,"Mathematics":30,"Meitei Mayek":20},
      CHAMPION:  {"Vocabulary":10,"General Knowledge":10,"Mathematics-II":20,"Mathematics - I":20,"Reasoning":20,"Grammar":10,"Science":10},
      LEADER:    {"Vocabulary":10,"Grammar":10,"General Knowledge":10,"Mathematics -I":20,"Mathematics - II":20,"Reasoning":20,"Science":10},
    },
  },
  {
    id: "monthly_test",
    name: "Monthly Test",
    description: "OMR-based",
    examMode: "OMR",
    sessions: [
      { label: "Session I",  time: "10:15 AM – 12:45 PM" },
      { label: "Session II", time: "01:30 PM – 03:30 PM" },
    ],
    courseSubjects: {
      ACHIEVER:  ["Mathematics -I","Mathematics - II","Reasoning","English Grammar","Vocabulary","Science","General Knowledge"],
CHAMPION:  ["Mathematics -I","Mathematics - II","Reasoning","English Grammar","Vocabulary","Science","General Knowledge"],
LEADER:    ["Mathematics -I","Mathematics - II","Reasoning","English Grammar","Vocabulary","Science","General Knowledge"],
      LAKSHYA:   ["Mathematics","Mental ability","Meitei Mayek / English Passage","English Grammar & Vocabulary"],
      UMEED:     ["Mathematics","Mental ability","Meitei Mayek / English Passage","English Grammar & Vocabulary"],
      ELITE:     ["Mathematics","Reasoning","English Grammar & Vocabulary","Meitei Mayek","Science"],
      PRIME:     ["Mathematics","Reasoning","English Grammar & Vocabulary","Meitei Mayek","Science"],
    },
    courseMaxMarks: {
      ACHIEVER:  {"Mathematics -I":75,"Mathematics - II":75,"Reasoning":50,"English Grammar":30,"Vocabulary":20,"Science":30,"General Knowledge":20},
CHAMPION:  {"Mathematics -I":75,"Mathematics - II":75,"Reasoning":50,"English Grammar":30,"Vocabulary":20,"Science":30,"General Knowledge":20},
LEADER:    {"Mathematics -I":75,"Mathematics - II":75,"Reasoning":50,"English Grammar":30,"Vocabulary":20,"Science":30,"General Knowledge":20},
      LAKSHYA:   {"Mathematics":30,"Mental ability":30,"Meitei Mayek / English Passage":20,"English Grammar & Vocabulary":20},
      UMEED:     {"Mathematics":30,"Mental ability":30,"Meitei Mayek / English Passage":20,"English Grammar & Vocabulary":20},
      ELITE:     {"Mathematics":30,"Reasoning":20,"English Grammar & Vocabulary":20,"Meitei Mayek":15,"Science":15},
      PRIME:     {"Mathematics":30,"Reasoning":20,"English Grammar & Vocabulary":20,"Meitei Mayek":15,"Science":15},
    },
  },
  {
    id: "pre_mock_test",
    name: "Pre Mock Test",
    description: "OMR-based",
    examDate: "",
    examMode: "OMR",
    sessions: [
      { label: "Session I",  time: "10:15 AM – 12:45 PM" },
      { label: "Session II", time: "01:30 PM – 03:30 PM" },
    ],
    courseSubjects: {
      ACHIEVER:  ["Mathematics -I","Mathematics - II","Reasoning","English Grammar","Vocabulary","Science","General Knowledge"],
      CHAMPION:  ["Mathematics -I","Mathematics - II","Reasoning","English Grammar","Vocabulary","Science","General Knowledge"],
      LEADER:    ["Mathematics -I","Mathematics - II","Reasoning","English Grammar","Vocabulary","Science","General Knowledge"],
      LAKSHYA:   ["Mathematics","Mental ability","Meitei Mayek / English Passage","English Grammar & Vocabulary"],
      UMEED:     ["Mathematics","Mental ability","Meitei Mayek / English Passage","English Grammar & Vocabulary"],
      ELITE:     ["Mathematics","Reasoning","English Grammar & Vocabulary","Meitei Mayek","Science"],
      PRIME:     ["Mathematics","Reasoning","English Grammar & Vocabulary","Meitei Mayek","Science"],
    },
    courseMaxMarks: {
      ACHIEVER:  {"Mathematics -I":75,"Mathematics - II":75,"Reasoning":50,"English Grammar":30,"Vocabulary":20,"Science":20,"General Knowledge":30},
      CHAMPION:  {"Mathematics -I":75,"Mathematics - II":75,"Reasoning":50,"English Grammar":30,"Vocabulary":20,"Science":20,"General Knowledge":30},
      LEADER:    {"Mathematics -I":75,"Mathematics - II":75,"Reasoning":50,"English Grammar":30,"Vocabulary":20,"Science":20,"General Knowledge":30},
      LAKSHYA:   {"Mathematics":30,"Mental ability":30,"Meitei Mayek / English Passage":20,"English Grammar & Vocabulary":20},
      UMEED:     {"Mathematics":30,"Mental ability":30,"Meitei Mayek / English Passage":20,"English Grammar & Vocabulary":20},
      ELITE:     {"Mathematics":30,"Reasoning":20,"English Grammar & Vocabulary":20,"Meitei Mayek":15,"Science":15},
      PRIME:     {"Mathematics":30,"Reasoning":20,"English Grammar & Vocabulary":20,"Meitei Mayek":15,"Science":15},
    },
  },
  {
    id: "mega_mock_test",
    name: "Mega Mock Test",
    description: "OMR-based",
    examDate: "",
    examMode: "OMR",
    sessions: [
      { label: "Session I",  time: "10:15 AM – 12:45 PM" },
      { label: "Session II", time: "01:30 PM – 03:30 PM" },
    ],
    courseSubjects: {
      ACHIEVER:  ["Mathematics -I","Mathematics - II","Reasoning","English Grammar","Vocabulary","Science","General Knowledge"],
      CHAMPION:  ["Mathematics -I","Mathematics - II","Reasoning","English Grammar","Vocabulary","Science","General Knowledge"],
      LEADER:    ["Mathematics -I","Mathematics - II","Reasoning","English Grammar","Vocabulary","Science","General Knowledge"],
      LAKSHYA:   ["Mathematics","Mental ability","Meitei Mayek / English Passage","English Grammar & Vocabulary"],
      UMEED:     ["Mathematics","Mental ability","Meitei Mayek / English Passage","English Grammar & Vocabulary"],
      ELITE:     ["Mathematics","Reasoning","English Grammar & Vocabulary","Meitei Mayek","Science"],
      PRIME:     ["Mathematics","Reasoning","English Grammar & Vocabulary","Meitei Mayek","Science"],
    },
    courseMaxMarks: {
      ACHIEVER:  {"Mathematics -I":75,"Mathematics - II":75,"Reasoning":50,"English Grammar":30,"Vocabulary":20,"Science":20,"General Knowledge":30},
      CHAMPION:  {"Mathematics -I":75,"Mathematics - II":75,"Reasoning":50,"English Grammar":30,"Vocabulary":20,"Science":20,"General Knowledge":30},
      LEADER:    {"Mathematics -I":75,"Mathematics - II":75,"Reasoning":50,"English Grammar":30,"Vocabulary":20,"Science":20,"General Knowledge":30},
      LAKSHYA:   {"Mathematics":30,"Mental ability":30,"Meitei Mayek / English Passage":20,"English Grammar & Vocabulary":20},
      UMEED:     {"Mathematics":30,"Mental ability":30,"Meitei Mayek / English Passage":20,"English Grammar & Vocabulary":20},
      ELITE:     {"Mathematics":30,"Reasoning":20,"English Grammar & Vocabulary":20,"Meitei Mayek":15,"Science":15},
      PRIME:     {"Mathematics":30,"Reasoning":20,"English Grammar & Vocabulary":20,"Meitei Mayek":15,"Science":15},
    },
  },
];

// ── helpers ────────────────────────────────────────────────────────────────

/** Deep-clone a config and return it with a fresh id and "Copy of …" name */
function cloneConfig(cfg) {
  return {
    ...JSON.parse(JSON.stringify(cfg)),
    id:   `custom_${Date.now()}`,
    name: `Copy of ${cfg.name}`,
  };
}

/** Trigger a browser file download of arbitrary text */
function downloadText(filename, text) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Exam Format Builder Wizard ─────────────────────────────────────────────
// editingConfig: if passed, the wizard opens pre-filled for editing
function ExamFormatBuilder({ courseSubjects, onSave, onCancel, editingConfig }) {
  const isMobile = useMobile();
  const allCourses = Object.keys(courseSubjects);
  const isEdit = !!editingConfig;

  // Wizard steps
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 5;

  // Step 1
  const [name, setName]         = useState(editingConfig?.name || "");
  const [description, setDesc]  = useState(editingConfig?.description || "");
  const [examDate, setExamDate] = useState(editingConfig?.examDate || "");
  const [examMode, setExamMode] = useState(editingConfig?.examMode || "Written");
  const [copyFrom, setCopyFrom] = useState("");

  // Step 2
  const [selectedCourses, setSelectedCourses] = useState(
    editingConfig ? new Set(Object.keys(editingConfig.courseSubjects || {})) : new Set(allCourses)
  );

  // Step 3 — pre-fill from editingConfig if present
  const buildInitialCourseData = () => {
    const data = {};
    const src = editingConfig || {};
    for (const c of (editingConfig ? Object.keys(src.courseSubjects || {}) : allCourses)) {
      data[c] = {
        subjects: [...(src.courseSubjects?.[c] || courseSubjects[c] || [])],
        marks:    { ...(src.courseMaxMarks?.[c] || {}) },
      };
    }
    return data;
  };
  const [courseData, setCourseData]   = useState(buildInitialCourseData);
  const [activeCourse, setActiveCourse] = useState(
    editingConfig ? Object.keys(editingConfig.courseSubjects || {})[0] : allCourses[0] || ""
  );
  const [subInput, setSubInput]   = useState("");
  const [markInput, setMarkInput] = useState("");
  const markRef = useRef("");
  const [editingSub, setEditingSub] = useState(null);

  // Step 4
  const [sessions, setSessions] = useState(
    editingConfig?.sessions?.length
      ? editingConfig.sessions.map(s => ({ ...s }))
      : [{ label: "Session I", time: "" }]
  );

  const [saving, setSaving] = useState(false);

  // copyFrom handler (only active when not editing)
  useEffect(() => {
    if (!copyFrom) return;
    const src = EXAM_CONFIG_PRESETS.find(p => p.id === copyFrom);
    if (!src) return;
    const data = {};
    for (const course of Object.keys(src.courseSubjects)) {
      data[course] = {
        subjects: [...src.courseSubjects[course]],
        marks: { ...(src.courseMaxMarks[course] || {}) },
      };
    }
    setCourseData(data);
    setSelectedCourses(new Set(Object.keys(src.courseSubjects)));
    setExamMode(src.examMode || "Written");
    setSessions(src.sessions?.length ? src.sessions.map(s => ({ ...s })) : [{ label: "Session I", time: "" }]);
  }, [copyFrom]);

  // Ensure courseData has entry for every selected course
  useEffect(() => {
    setCourseData(prev => {
      const next = { ...prev };
      for (const c of selectedCourses) {
        if (!next[c]) {
          next[c] = {
            subjects: [...(courseSubjects[c] || [])],
            marks: {},
          };
        }
      }
      return next;
    });
    const arr = [...selectedCourses];
    if (arr.length && !selectedCourses.has(activeCourse)) setActiveCourse(arr[0]);
  }, [selectedCourses]);

  const toggleCourse = (c) => {
    setSelectedCourses(prev => {
      const n = new Set(prev);
      n.has(c) ? n.delete(c) : n.add(c);
      return n;
    });
  };

  const addSubject = () => {
    const sub = subInput.trim();
    if (!sub || !activeCourse) return;
    setCourseData(prev => {
      const existing = prev[activeCourse] || { subjects: [], marks: {} };
      if (existing.subjects.includes(sub)) return prev;
      return { ...prev, [activeCourse]: { ...existing, subjects: [...existing.subjects, sub] } };
    });
    setSubInput("");
  };

  const removeSubject = (course, sub) => {
    setCourseData(prev => {
      const existing = prev[course] || { subjects: [], marks: {} };
      const marks = { ...existing.marks };
      delete marks[sub];
      return { ...prev, [course]: { ...existing, subjects: existing.subjects.filter(s => s !== sub), marks } };
    });
  };

  const setMark = (course, sub, val) => {
    setCourseData(prev => {
      const existing = prev[course] || { subjects: [], marks: {} };
      return { ...prev, [course]: { ...existing, marks: { ...existing.marks, [sub]: Number(val) } } };
    });
  };

  // FIX: add subject + set mark atomically in one setState call, no setTimeout
  const addSubjectWithMark = (overrideMark) => {
    const sub = subInput.trim();
    if (!sub || !activeCourse) return;
    const raw = overrideMark !== undefined ? overrideMark : markRef.current;
    const parsed = parseInt(String(raw), 10);
    const markVal = (!isNaN(parsed) && parsed > 0) ? parsed : undefined;
    setCourseData(prev => {
      const existing = prev[activeCourse] || { subjects: [], marks: {} };
      if (existing.subjects.includes(sub)) return prev;
      const newMarks = markVal !== undefined
        ? { ...existing.marks, [sub]: markVal }
        : existing.marks;
      return { ...prev, [activeCourse]: { ...existing, subjects: [...existing.subjects, sub], marks: newMarks } };
    });
    setSubInput("");
    setMarkInput("");
  };

  const autoSplitMarks = (course, total = 100) => {
    const subs = courseData[course]?.subjects || [];
    if (!subs.length) return;
    const per = Math.floor(total / subs.length);
    const rem = total - per * subs.length;
    const marks = {};
    subs.forEach((s, i) => { marks[s] = per + (i === 0 ? rem : 0); });
    setCourseData(prev => ({ ...prev, [course]: { ...prev[course], marks } }));
  };

  const getTotalForCourse = (course) => {
    const marks = courseData[course]?.marks || {};
    return Object.values(marks).reduce((s, v) => s + (Number(v) || 0), 0);
  };

  const addSession = () => setSessions(p => [...p, { label: `Session ${p.length + 1}`, time: "" }]);
  const removeSession = (i) => setSessions(p => p.filter((_, j) => j !== i));
  const updateSession = (i, key, val) => setSessions(p => p.map((s, j) => j === i ? { ...s, [key]: val } : s));

  const handleSave = async () => {
    setSaving(true);
    const courseSubjectsOut = {};
    const courseMaxMarksOut = {};
    for (const course of selectedCourses) {
      const d = courseData[course] || { subjects: [], marks: {} };
      courseSubjectsOut[course] = d.subjects;
      courseMaxMarksOut[course] = d.marks;
    }
    const cfg = {
      id: isEdit ? editingConfig.id : `custom_${Date.now()}`,
      name: name.trim(),
      description: description.trim(),
      examDate,
      examMode,
      sessions,
      courseSubjects: courseSubjectsOut,
      courseMaxMarks: courseMaxMarksOut,
    };
    await onSave(cfg);
    setSaving(false);
  };

  const canNext = () => {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return selectedCourses.size > 0;
    if (step === 3) {
      for (const c of selectedCourses) {
        if (!(courseData[c]?.subjects?.length)) return false;
      }
      return true;
    }
    return true;
  };

  const STEP_LABELS = ["Basic Info", "Courses", "Subjects & Marks", "Sessions", "Review"];
  const StepBar = () => (
    <div style={{ display:"flex", alignItems:"center", marginBottom:24, gap:0 }}>
      {STEP_LABELS.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <React.Fragment key={n}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4, cursor: done ? "pointer" : "default" }}
              onClick={() => done && setStep(n)}>
              <div style={{
                width:30, height:30, borderRadius:"50%", display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:13, fontWeight:700,
                background: done ? "#1a3c2e" : active ? "#2A5C45" : "#F1F5F9",
                color: (done || active) ? "white" : "#9CA3AF",
                border: active ? "2px solid #1a3c2e" : "none",
              }}>
                {done ? "✓" : n}
              </div>
              {!isMobile && <div style={{ fontSize:9, fontWeight:700, color: active ? "#1a3c2e" : done ? "#0F6E56" : "#9CA3AF", textTransform:"uppercase", letterSpacing:".08em", whiteSpace:"nowrap" }}>{label}</div>}
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div style={{ flex:1, height:2, background: step > n ? "#1a3c2e" : "#E5E7EB", margin:"0 4px 18px" }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );

  const NavButtons = () => (
    <div style={{ display:"flex", gap:10, marginTop:24, paddingTop:16, borderTop:"1px solid #F1F5F9" }}>
      {step > 1 && <button onClick={() => setStep(s => s-1)} style={{ ...css.btn, background:"#F3F4F6", color:"#374151", flex:1 }}>← Back</button>}
      {step < TOTAL_STEPS
        ? <button onClick={() => setStep(s => s+1)} disabled={!canNext()} style={{ ...css.btn, background:canNext()?"#1a3c2e":"#D1D5DB", color:"white", flex:2, fontSize:14 }}>
            Next →
          </button>
        : <button onClick={handleSave} disabled={saving} style={{ ...css.btn, background:saving?"#93C5FD":"#16A34A", color:"white", flex:2, fontSize:14 }}>
            {saving ? "⏳ Saving…" : isEdit ? "✅ Save Changes" : "✅ Create Exam Format"}
          </button>
      }
    </div>
  );

  // ── STEP 1 ──────────────────────────────────────────────────────────────
  const Step1 = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div>
        <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:5, textTransform:"uppercase" }}>Exam Name *</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. 3rd Monthly Test — August 2026" style={{ ...css.input, fontSize:15 }} autoFocus />
      </div>
      <div>
        <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:5, textTransform:"uppercase" }}>Short Description</label>
        <input value={description} onChange={e=>setDesc(e.target.value)} placeholder="e.g. OMR-based · August 2026" style={css.input} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:12 }}>
        <div>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:5, textTransform:"uppercase" }}>Exam Date</label>
          <input type="date" value={examDate} onChange={e=>setExamDate(e.target.value)} style={css.input} />
        </div>
        <div>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:5, textTransform:"uppercase" }}>Exam Mode</label>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {["Written","OMR","Online","Oral"].map(m => (
              <button key={m} onClick={() => setExamMode(m)}
                style={{ ...css.btn, padding:"7px 16px", fontSize:12, background:examMode===m?"#1a3c2e":"#F3F4F6", color:examMode===m?"white":"#374151", border:examMode===m?"none":"1px solid #E5E7EB" }}>
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hide "copy from" in edit mode — user is already editing an existing one */}
      {!isEdit && (
        <>
          <div style={{ height:1, background:"#F1F5F9" }} />
          <div>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:8, textTransform:"uppercase" }}>
              Copy from existing format <span style={{ fontWeight:400, color:"#9CA3AF" }}>(optional)</span>
            </label>
            <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(200px,1fr))", gap:8 }}>
              <div onClick={() => setCopyFrom("")}
                style={{ padding:"10px 14px", borderRadius:10, border: !copyFrom?"2px solid #1a3c2e":"1px solid #E5E7EB", background: !copyFrom?"#E1F5EE":"#F9FAFB", cursor:"pointer" }}>
                <div style={{ fontWeight:700, fontSize:12, color: !copyFrom?"#0F6E56":"#374151" }}>Start fresh</div>
                <div style={{ fontSize:11, color:"#9CA3AF", marginTop:2 }}>Define everything from scratch</div>
              </div>
              {EXAM_CONFIG_PRESETS.map(p => (
                <div key={p.id} onClick={() => setCopyFrom(p.id)}
                  style={{ padding:"10px 14px", borderRadius:10, border: copyFrom===p.id?"2px solid #1a3c2e":"1px solid #E5E7EB", background: copyFrom===p.id?"#E1F5EE":"#F9FAFB", cursor:"pointer" }}>
                  <div style={{ fontWeight:700, fontSize:12, color: copyFrom===p.id?"#0F6E56":"#374151" }}>{p.name}</div>
                  <div style={{ fontSize:11, color:"#9CA3AF", marginTop:2 }}>{p.description || "Built-in preset"}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  // ── STEP 2 ──────────────────────────────────────────────────────────────
  const Step2 = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ fontSize:13, color:"#64748b" }}>Select which courses/batches this exam applies to.</div>
      <div style={{ display:"flex", gap:8, marginBottom:4 }}>
        <button onClick={() => setSelectedCourses(new Set(allCourses))} style={{ ...css.btn, padding:"5px 12px", fontSize:11, background:"#E0F2FE", color:"#0369A1" }}>Select All</button>
        <button onClick={() => setSelectedCourses(new Set())} style={{ ...css.btn, padding:"5px 12px", fontSize:11, background:"#FEF2F2", color:"#DC2626" }}>Clear All</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill,minmax(160px,1fr))", gap:10 }}>
        {allCourses.map(c => {
          const sel = selectedCourses.has(c);
          const subCount = courseData[c]?.subjects?.length || courseSubjects[c]?.length || 0;
          return (
            <div key={c} onClick={() => toggleCourse(c)}
              style={{ padding:"14px 16px", borderRadius:12, border: sel?"2px solid #1a3c2e":"1.5px solid #E5E7EB", background: sel?"#E1F5EE":"#F9FAFB", cursor:"pointer", transition:"all .15s" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ fontWeight:700, fontSize:14, color: sel?"#0F6E56":"#374151" }}>{c}</div>
                <div style={{ width:20, height:20, borderRadius:"50%", background: sel?"#0F6E56":"#E5E7EB", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"white", fontWeight:700 }}>
                  {sel ? "✓" : ""}
                </div>
              </div>
              <div style={{ fontSize:11, color:"#9CA3AF", marginTop:4 }}>{subCount} subjects</div>
            </div>
          );
        })}
      </div>
      <div style={{ background:"#F8FAFC", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#64748b" }}>
        {selectedCourses.size} course{selectedCourses.size !== 1 ? "s" : ""} selected: <b style={{ color:"#1a3c2e" }}>{[...selectedCourses].join(", ") || "none"}</b>
      </div>
    </div>
  );

  // ── STEP 3 ──────────────────────────────────────────────────────────────
  const Step3 = () => {
    const courseArr = [...selectedCourses];
    const d = courseData[activeCourse] || { subjects: [], marks: {} };
    const total = getTotalForCourse(activeCourse);

    return (
      <div style={{ display:"flex", flexDirection: isMobile ? "column" : "row", gap:16 }}>
        <div style={{ width: isMobile ? "100%" : 160, flexShrink:0 }}>
          <div style={{ fontSize:11, fontWeight:700, color:"#6B7280", textTransform:"uppercase", marginBottom:8 }}>Courses</div>
          <div style={{ display:"flex", flexDirection: isMobile ? "row" : "column", flexWrap:"wrap", gap:5 }}>
            {courseArr.map(c => {
              const cd = courseData[c] || { subjects:[], marks:{} };
              const ok = cd.subjects.length > 0;
              return (
                <button key={c} onClick={() => setActiveCourse(c)}
                  style={{ ...css.btn, padding:"8px 12px", textAlign:"left", fontSize:12,
                    background: activeCourse===c?"#1a3c2e":"#F9FAFB",
                    color: activeCourse===c?"white":"#374151",
                    border: activeCourse===c?"none": ok?"1px solid #BBF7D0":"1px solid #E5E7EB",
                    display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
                  <span>{c}</span>
                  <span style={{ fontSize:10, opacity:0.75 }}>{ok ? `${cd.subjects.length}s` : "⚠️"}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontWeight:700, fontSize:15, color:"#1a3c2e" }}>{activeCourse}</div>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <span style={{ fontSize:11, color: total===100?"#0F6E56":total>100?"#DC2626":"#9CA3AF", fontWeight:700 }}>
                Total: {total} / 100
              </span>
              <button onClick={() => autoSplitMarks(activeCourse, 100)}
                style={{ ...css.btn, padding:"4px 10px", fontSize:11, background:"#EFF6FF", color:"#1D4ED8", border:"1px solid #BFDBFE" }}>
                ⚡ Auto-split 100
              </button>
            </div>
          </div>

          {/* Add subject row — fixed: atomic addSubjectWithMark */}
          <div style={{ display:"flex", gap:8, marginBottom:12 }}>
            <input value={subInput} onChange={e=>setSubInput(e.target.value)}
              placeholder="Subject name…" style={{ ...css.input, flex:2 }}
              onKeyDown={e=>{ if(e.key==="Enter") addSubjectWithMark(); }} />
            <input
  type="number"
  value={markInput}
  onChange={e => { setMarkInput(e.target.value); markRef.current = e.target.value; }}
  placeholder="Max"
  min="0"
  style={{ ...css.input, width: 70, MozAppearance: "textfield" }}
  onKeyDown={e => { if (e.key === "Enter") addSubjectWithMark(); }}
/>
            <button onClick={addSubjectWithMark}
              style={{ ...css.btn, background:"#1a3c2e", color:"white", whiteSpace:"nowrap" }}>+ Add</button>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {d.subjects.map((sub, i) => (
              <div key={sub} style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", background: i%2?"#F9FAFB":"white", borderRadius:8, border:"1px solid #F1F5F9" }}>
                <div style={{ fontSize:10, color:"#CBD5E1", fontWeight:700, width:18, flexShrink:0 }}>{i+1}</div>
                <div style={{ flex:1, fontSize:13, fontWeight:600, color:"#1e293b" }}>{sub}</div>
                {editingSub === `${activeCourse}-${sub}` ? (
                  <input type="number" autoFocus defaultValue={d.marks[sub]||""}
                    style={{ ...css.input, width:70, fontSize:13, padding:"4px 8px" }}
                    onBlur={e => { setMark(activeCourse, sub, e.target.value); setEditingSub(null); }}
                    onKeyDown={e => { if(e.key==="Enter") { setMark(activeCourse, sub, e.target.value); setEditingSub(null); } }} />
                ) : (
                  <div onClick={() => setEditingSub(`${activeCourse}-${sub}`)}
                    style={{ width:70, textAlign:"center", padding:"4px 8px", borderRadius:6, border:"1px solid #E5E7EB", fontSize:13, fontWeight:700, color: d.marks[sub]?"#1a3c2e":"#CBD5E1", cursor:"pointer", background:"#F9FAFB" }}>
                    {d.marks[sub] || "—"}
                  </div>
                )}
                <span style={{ fontSize:11, color:"#9CA3AF" }}>marks</span>
                <button onClick={() => removeSubject(activeCourse, sub)}
                  style={{ ...css.btn, padding:"3px 8px", background:"#FEF2F2", color:"#DC2626", border:"1px solid #FECACA", fontSize:11 }}>✕</button>
              </div>
            ))}
            {!d.subjects.length && (
              <div style={{ padding:"24px 0", textAlign:"center", color:"#CBD5E1", fontSize:13 }}>
                No subjects yet. Add subjects above.
              </div>
            )}
          </div>

          <div style={{ marginTop:14, display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ fontSize:11, color:"#9CA3AF", fontWeight:700 }}>Copy from:</span>
            {[...selectedCourses].filter(c => c !== activeCourse).map(c => (
              <button key={c} onClick={() => {
                const src = courseData[c];
                if (!src) return;
                setCourseData(prev => ({
                  ...prev,
                  [activeCourse]: { subjects:[...src.subjects], marks:{...src.marks} }
                }));
              }} style={{ ...css.btn, padding:"3px 10px", fontSize:11, background:"#F3F4F6", color:"#374151", border:"1px solid #E5E7EB" }}>
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  // ── STEP 4 ──────────────────────────────────────────────────────────────
  const Step4 = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
      <div style={{ fontSize:13, color:"#64748b" }}>Define exam sessions (optional). These appear on admit cards and the schedule.</div>
      {sessions.map((s, i) => (
        <div key={i} style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr auto", gap:10, alignItems:"flex-end", padding:"12px 14px", background:"#F9FAFB", borderRadius:10, border:"1px solid #E5E7EB" }}>
          <div>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:4, textTransform:"uppercase" }}>Session Label</label>
            <input value={s.label} onChange={e=>updateSession(i,"label",e.target.value)} placeholder="e.g. Session I" style={css.input} />
          </div>
          <div>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#6B7280", marginBottom:4, textTransform:"uppercase" }}>Time</label>
            <input value={s.time} onChange={e=>updateSession(i,"time",e.target.value)} placeholder="e.g. 10:15 AM – 12:45 PM" style={css.input} />
          </div>
          <button onClick={() => removeSession(i)} style={{ ...css.btn, padding:"8px 12px", background:"#FEF2F2", color:"#DC2626", border:"1px solid #FECACA", alignSelf:"flex-end" }}>✕</button>
        </div>
      ))}
      <button onClick={addSession} style={{ ...css.btn, background:"#EFF6FF", color:"#1D4ED8", border:"1px solid #BFDBFE", fontSize:13 }}>+ Add Session</button>
      <div style={{ height:1, background:"#F1F5F9", margin:"4px 0" }} />
      <div style={{ fontWeight:700, fontSize:13, color:"#1e293b", marginBottom:6 }}>📅 Evaluation Timeline <span style={{ fontWeight:400, fontSize:11, color:"#9CA3AF" }}>(optional)</span></div>
      <EvaluationTimeline examDate={examDate} />
    </div>
  );

  // ── STEP 5 ──────────────────────────────────────────────────────────────
  const Step5 = () => {
    const courseArr = [...selectedCourses];
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ background:"linear-gradient(135deg,#1a3c2e,#2A5C45)", borderRadius:12, padding:"16px 20px", color:"white" }}>
          <div style={{ fontFamily:"'Playfair Display',serif", fontSize:20, marginBottom:4 }}>{name || "Untitled Exam"}</div>
          <div style={{ fontSize:12, opacity:.75 }}>{description}</div>
          <div style={{ display:"flex", gap:12, marginTop:10, flexWrap:"wrap" }}>
            {examDate && <span style={{ fontSize:11, background:"rgba(255,255,255,.12)", padding:"3px 10px", borderRadius:999 }}>📅 {examDate}</span>}
            <span style={{ fontSize:11, background:"rgba(255,255,255,.12)", padding:"3px 10px", borderRadius:999 }}>📝 {examMode}</span>
            <span style={{ fontSize:11, background:"rgba(255,255,255,.12)", padding:"3px 10px", borderRadius:999 }}>🏫 {selectedCourses.size} courses</span>
            {sessions.filter(s=>s.time).length > 0 && <span style={{ fontSize:11, background:"rgba(255,255,255,.12)", padding:"3px 10px", borderRadius:999 }}>⏰ {sessions.length} session{sessions.length>1?"s":""}</span>}
          </div>
        </div>

        <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
          {courseArr.map(c => {
            const d = courseData[c] || { subjects:[], marks:{} };
            const total = Object.values(d.marks).reduce((s,v)=>s+(Number(v)||0),0);
            const ok = d.subjects.length > 0;
            return (
              <div key={c} style={{ background:"white", borderRadius:10, border: ok?"1px solid #BBF7D0":"1px solid #FECACA", padding:"12px 14px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div style={{ fontWeight:700, color:"#1a3c2e", fontSize:13 }}>{c}</div>
                  <span style={{ fontSize:11, padding:"2px 8px", borderRadius:999, background: total===100?"#E1F5EE":total>100?"#FCEBEB":"#FFFBEB", color: total===100?"#0F6E56":total>100?"#DC2626":"#92400E", fontWeight:700 }}>
                    {total} marks
                  </span>
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                  {d.subjects.map(s => (
                    <span key={s} style={{ fontSize:10, padding:"2px 8px", background:"#F1F5F9", borderRadius:999, color:"#475569" }}>
                      {s}{d.marks[s] ? <span style={{ color:"#94A3B8", marginLeft:2 }}>/{d.marks[s]}</span> : null}
                    </span>
                  ))}
                  {!ok && <span style={{ fontSize:11, color:"#DC2626" }}>⚠️ No subjects defined</span>}
                </div>
              </div>
            );
          })}
        </div>

        {sessions.filter(s=>s.time).length > 0 && (
          <div style={{ background:"#F8FAFC", borderRadius:10, padding:"12px 16px", border:"1px solid #E5E7EB" }}>
            <div style={{ fontWeight:700, fontSize:12, color:"#6B7280", textTransform:"uppercase", marginBottom:8 }}>Sessions</div>
            {sessions.map((s,i) => (
              <div key={i} style={{ fontSize:13, color:"#374151", marginBottom:4 }}>
                <b>{s.label}</b>{s.time ? ` · ${s.time}` : ""}
              </div>
            ))}
          </div>
        )}

        <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#1D4ED8" }}>
          ℹ️ {isEdit ? "Changes will be saved. Click Activate on the config list if you want to apply it now." : "Once created, go to the config list and click Activate to apply this format across all tabs."}
        </div>
      </div>
    );
  };

  const stepContent = [<Step1/>, <Step2/>, <Step3/>, <Step4/>, <Step5/>];
  const stepTitles  = ["Basic Information", "Select Courses", "Subjects & Marks", "Exam Sessions", "Review & " + (isEdit ? "Save" : "Create")];

  return (
    <div style={{ background:"white", borderRadius:14, boxShadow:"0 2px 16px rgba(0,0,0,0.09)", overflow:"hidden" }}>
      <div style={{ background:"linear-gradient(135deg,#1a3c2e,#2A5C45)", padding:"18px 24px" }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:"white", marginBottom:2 }}>
          {isEdit ? "✏️ Edit Exam Format" : "✏️ Exam Format Builder"}
        </div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)" }}>Step {step} of {TOTAL_STEPS} — {stepTitles[step-1]}</div>
      </div>

      <div style={{ padding: isMobile ? "16px 14px" : "24px 28px" }}>
        <StepBar />
        {stepContent[step - 1]}
        <NavButtons />
      </div>

      <div style={{ padding:"0 28px 18px", textAlign:"center" }}>
        <button onClick={onCancel} style={{ ...css.btn, background:"none", color:"#9CA3AF", fontSize:12, border:"none" }}>✕ Cancel and go back</button>
      </div>
    </div>
  );
}

// ── EvaluationTimeline ─────────────────────────────────────────────────────
function EvaluationTimeline({ examDate }) {
  const [rows, setRows] = useState([
    { label: "OMR Evaluation & Mark Entry", date: "" },
    { label: "Final Check by Marking Students", date: "" },
    { label: "Report Card Entry by Class Teacher", date: "" },
    { label: "Prize Distribution", date: "" },
    { label: "Report Card Distribution to Parents", date: "" },
  ]);

  const autoFill = () => {
    if (!examDate) return;
    const base = new Date(examDate);
    const add = (d, n) => { const x = new Date(d); x.setDate(x.getDate()+n); return x.toISOString().split("T")[0]; };
    setRows([
      { label: "OMR Evaluation & Mark Entry",             date: `${add(base,1)} to ${add(base,4)}` },
      { label: "Final Check by Marking Students",         date: add(base,6) },
      { label: "Report Card Entry by Class Teacher",      date: add(base,6) },
      { label: "Prize Distribution",                      date: add(base,8) },
      { label: "Report Card Distribution to Parents",     date: `${add(base,9)} to ${add(base,10)}` },
    ]);
  };

  return (
    <div>
      {examDate && (
        <button onClick={autoFill} style={{ ...css.btn, padding:"5px 14px", fontSize:11, background:"#EFF6FF", color:"#1D4ED8", border:"1px solid #BFDBFE", marginBottom:10 }}>
          ⚡ Auto-fill from exam date ({examDate})
        </button>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {rows.map((r,i) => (
          <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, alignItems:"center" }}>
            <div style={{ fontSize:12, color:"#374151", fontWeight:600 }}>{r.label}</div>
            <input value={r.date} onChange={e => setRows(p => p.map((x,j)=>j===i?{...x,date:e.target.value}:x))}
              placeholder="Date or range…" style={{ ...css.input, fontSize:12 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── NEW: Admit-card-style Preview Modal ────────────────────────────────────
function ExamPreviewModal({ cfg, onClose }) {
  const isMobile = useMobile();
  const courses  = Object.keys(cfg.courseSubjects || {});

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.55)", zIndex:1100,
      display:"flex", alignItems:"center", justifyContent:"center", padding:16, overflowY:"auto" }}>
      <div style={{ background:"white", borderRadius:14, width:"100%", maxWidth:700,
        maxHeight:"92vh", overflowY:"auto", boxShadow:"0 8px 40px rgba(0,0,0,0.25)" }}>

        {/* sticky header */}
        <div style={{ background:"linear-gradient(135deg,#1a3c2e,#2A5C45)", padding:"14px 20px",
          display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0, zIndex:10 }}>
          <div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:"white" }}>👁 Preview — {cfg.name}</div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,.6)", marginTop:2 }}>{cfg.description}</div>
          </div>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            {/* Export from preview shortcut */}
            <button onClick={() => downloadText(`${cfg.name.replace(/\s+/g,"_")}.json`, JSON.stringify(cfg, null, 2))}
              style={{ ...css.btn, padding:"6px 12px", background:"rgba(255,255,255,.15)", color:"white", fontSize:11, border:"1px solid rgba(255,255,255,.3)" }}>
              ⬇ Export
            </button>
            <button onClick={onClose}
              style={{ background:"rgba(255,255,255,.15)", border:"none", borderRadius:6, padding:"5px 12px", color:"white", cursor:"pointer", fontSize:13 }}>✕</button>
          </div>
        </div>

        <div style={{ padding: isMobile ? "16px 14px" : "22px 26px" }}>

          {/* Meta strip */}
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:18 }}>
            {cfg.examDate && <span style={{ fontSize:11, padding:"3px 12px", borderRadius:999, background:"#E0F2FE", color:"#0369A1", fontWeight:700 }}>📅 {cfg.examDate}</span>}
            {cfg.examMode && <span style={{ fontSize:11, padding:"3px 12px", borderRadius:999, background:"#EEF2FF", color:"#4338CA", fontWeight:700 }}>📝 {cfg.examMode}</span>}
            {cfg.sessions?.filter(s=>s.time).length > 0 &&
              <span style={{ fontSize:11, padding:"3px 12px", borderRadius:999, background:"#FFF7ED", color:"#C2410C", fontWeight:700 }}>
                ⏰ {cfg.sessions.length} Session{cfg.sessions.length>1?"s":""}
              </span>}
          </div>

          {/* Sessions table */}
          {cfg.sessions?.filter(s=>s.time).length > 0 && (
            <div style={{ marginBottom:22 }}>
              <div style={{ fontWeight:700, fontSize:12, color:"#6B7280", textTransform:"uppercase", marginBottom:8, letterSpacing:".06em" }}>Exam Schedule</div>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ background:"#F8FAFC" }}>
                    <th style={{ padding:"8px 12px", textAlign:"left", borderBottom:"2px solid #E5E7EB", color:"#1a3c2e", fontWeight:700 }}>Session</th>
                    <th style={{ padding:"8px 12px", textAlign:"left", borderBottom:"2px solid #E5E7EB", color:"#1a3c2e", fontWeight:700 }}>Timing</th>
                  </tr>
                </thead>
                <tbody>
                  {cfg.sessions.filter(s=>s.time).map((s,i) => (
                    <tr key={i} style={{ borderBottom:"1px solid #F1F5F9" }}>
                      <td style={{ padding:"8px 12px", fontWeight:600, color:"#374151" }}>{s.label}</td>
                      <td style={{ padding:"8px 12px", color:"#64748b" }}>{s.time}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Per-course mark tables */}
          {courses.map(course => {
            const subs  = cfg.courseSubjects[course] || [];
            const marks = cfg.courseMaxMarks?.[course] || {};
            const total = Object.values(marks).reduce((s,v)=>s+(Number(v)||0),0);
            return (
              <div key={course} style={{ marginBottom:20 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  background:"linear-gradient(90deg,#1a3c2e 0%,#2A5C45 100%)",
                  borderRadius:"8px 8px 0 0", padding:"8px 14px" }}>
                  <div style={{ fontWeight:700, color:"white", fontSize:13 }}>{course}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,.75)", fontWeight:600 }}>Total: {total} marks</div>
                </div>
                <table style={{ width:"100%", borderCollapse:"collapse", fontSize:13, border:"1px solid #E5E7EB", borderTop:"none" }}>
                  <thead>
                    <tr style={{ background:"#F8FAFC" }}>
                      <th style={{ padding:"7px 12px", textAlign:"left", color:"#6B7280", fontWeight:700, fontSize:11, textTransform:"uppercase", width:36 }}>#</th>
                      <th style={{ padding:"7px 12px", textAlign:"left", color:"#6B7280", fontWeight:700, fontSize:11, textTransform:"uppercase" }}>Subject</th>
                      <th style={{ padding:"7px 12px", textAlign:"center", color:"#6B7280", fontWeight:700, fontSize:11, textTransform:"uppercase", width:90 }}>Max Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subs.map((sub, i) => (
                      <tr key={sub} style={{ borderBottom:"1px solid #F1F5F9", background: i%2?"#FAFAFA":"white" }}>
                        <td style={{ padding:"8px 12px", color:"#CBD5E1", fontWeight:700 }}>{i+1}</td>
                        <td style={{ padding:"8px 12px", color:"#1e293b", fontWeight:500 }}>{sub}</td>
                        <td style={{ padding:"8px 12px", textAlign:"center", fontWeight:700,
                          color: marks[sub] ? "#1a3c2e" : "#CBD5E1" }}>
                          {marks[sub] || "—"}
                        </td>
                      </tr>
                    ))}
                    {/* Total row */}
                    <tr style={{ background:"#F0FDF4", borderTop:"2px solid #BBF7D0" }}>
                      <td colSpan={2} style={{ padding:"9px 12px", fontWeight:700, color:"#166534", fontSize:13 }}>TOTAL</td>
                      <td style={{ padding:"9px 12px", textAlign:"center", fontWeight:800, color:"#166534", fontSize:14 }}>{total}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Main ExamConfigManager ─────────────────────────────────────────────────
function ExamConfigManager({ courseSubjects, onUpdate, activeConfigId, onConfigSwitch }) {
  const isMobile = useMobile();
  const [configs, setConfigs]       = useState(EXAM_CONFIG_PRESETS);
  const [loading, setLoading]       = useState(true);
  const [activeId, setActiveId]     = useState(activeConfigId || "default");
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingConfig, setEditingConfig] = useState(null); // config to edit, or null for "new"
  const [switching, setSwitching]   = useState(false);
  const [switchDone, setSwitchDone] = useState(false);
  const [deleteId, setDeleteId]     = useState(null);
  const [viewId, setViewId]         = useState(null);   // detail modal (old)
  const [previewCfg, setPreviewCfg] = useState(null);   // NEW: admit-card preview
  const [importError, setImportError] = useState("");   // NEW: import feedback
  const importRef = React.useRef();

  useEffect(() => {
    Promise.all([
      supabase.from("system_settings").select("value").eq("key","exam_configs").single(),
      supabase.from("system_settings").select("value").eq("key","active_exam_config").single(),
    ]).then(([{ data: cfgData }, { data: actData }]) => {
      let allConfigs = [...EXAM_CONFIG_PRESETS];
if (cfgData?.value) {
  try { allConfigs = [...EXAM_CONFIG_PRESETS, ...JSON.parse(cfgData.value)]; } catch(_) {}
}
setConfigs(allConfigs);
const savedId = actData?.value || "default";
setActiveId(savedId);
const activeCfg = allConfigs.find(c => c.id === savedId);
if (activeCfg?.courseMaxMarks) {
  window.__gnsiCourseMaxMarks = activeCfg.courseMaxMarks;
}
setLoading(false);
    });
  }, []);

  const saveCustomConfigs = async (all) => {
    const custom = all.filter(c => !EXAM_CONFIG_PRESETS.find(p => p.id === c.id));
    await supabase.from("system_settings").upsert({ key:"exam_configs", value:JSON.stringify(custom) }, { onConflict:"key" });
  };

  const handleSwitch = async (cfg) => {
    if (cfg.id === activeId) return;
    setSwitching(true);
    await supabase.from("system_settings").upsert({ key:"active_exam_config", value:cfg.id }, { onConflict:"key" });
    await supabase.from("system_settings").upsert({ key:"course_subjects", value:JSON.stringify(cfg.courseSubjects) }, { onConflict:"key" });
    window.__gnsiCourseMaxMarks = cfg.courseMaxMarks || {};
    setActiveId(cfg.id);
    onUpdate(cfg.courseSubjects);
    onConfigSwitch && onConfigSwitch(cfg);
    setSwitching(false); setSwitchDone(true);
    setTimeout(() => setSwitchDone(false), 3000);
  };

  const handleDelete = async (id) => {
    const updated = configs.filter(c => c.id !== id);
    setConfigs(updated);
    await saveCustomConfigs(updated);
    setDeleteId(null);
    if (activeId === id) handleSwitch(EXAM_CONFIG_PRESETS[0]);
  };

  // NEW: handles both create-new and save-after-edit
  const handleSaveNew = async (cfg) => {
  const isEditing = !!editingConfig;
  const existsInList = configs.some(c => c.id === cfg.id);
  let updated;
  if (isEditing && existsInList) {
    // update in-place (custom config edited)
    updated = configs.map(c => c.id === cfg.id ? cfg : c);
  } else {
    // new config OR built-in was cloned+edited → append
    updated = [...configs, cfg];
  }
  setConfigs(updated);
  await saveCustomConfigs(updated);
  setShowBuilder(false);
  setEditingConfig(null);
  // propagate immediately if this was the active config
  if (cfg.id === activeId) {
    window.__gnsiCourseMaxMarks = cfg.courseMaxMarks || {};
    onUpdate(cfg.courseSubjects);
    onConfigSwitch && onConfigSwitch(cfg);
  }
};

  // NEW: Duplicate
  const handleDuplicate = async (cfg) => {
    const clone = cloneConfig(cfg);
    const updated = [...configs, clone];
    setConfigs(updated);
    await saveCustomConfigs(updated);
  };

  // NEW: Export single config
  const handleExport = (cfg) => {
    downloadText(`${cfg.name.replace(/\s+/g,"_")}.json`, JSON.stringify(cfg, null, 2));
  };

  // NEW: Import from .json file
  const handleImportFile = async (e) => {
    setImportError("");
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      // Validate minimum shape
      if (!parsed.name || !parsed.courseSubjects) throw new Error("Missing required fields (name, courseSubjects).");
      // Give it a fresh id so it doesn't collide
      const imported = { ...parsed, id: `custom_${Date.now()}`, name: parsed.name + (parsed.name.includes("(imported)") ? "" : " (imported)") };
      const updated = [...configs, imported];
      setConfigs(updated);
      await saveCustomConfigs(updated);
    } catch (err) {
      setImportError(`Import failed: ${err.message}`);
    }
    // Reset file input so same file can be re-imported if needed
    e.target.value = "";
  };

  const getTotalMarks = (cfg, course) => {
    const map = cfg.courseMaxMarks?.[course] || {};
    return Object.values(map).reduce((s,v)=>s+v,0) || 100;
  };

  if (loading) return <Spinner />;

  // Show builder (new or edit)
  if (showBuilder) return (
    <ExamFormatBuilder
      courseSubjects={courseSubjects}
      onSave={handleSaveNew}
      onCancel={() => { setShowBuilder(false); setEditingConfig(null); }}
      editingConfig={editingConfig}
    />
  );

  const viewCfg = viewId ? configs.find(c => c.id === viewId) : null;

  return (
    <div>
      {/* ── Modals ── */}

      {/* Delete confirm */}
      {deleteId && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ background:"white", borderRadius:14, padding:28, maxWidth:380, width:"90%", boxShadow:"0 8px 40px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize:32, textAlign:"center", marginBottom:12 }}>⚠️</div>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:600, textAlign:"center", marginBottom:8 }}>Delete Configuration?</div>
            <div style={{ fontSize:13, color:"#64748b", textAlign:"center", marginBottom:22 }}>
              Permanently delete <b>{configs.find(c=>c.id===deleteId)?.name}</b>?
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setDeleteId(null)} style={{ ...css.btn, flex:1, background:"#F3F4F6", color:"#374151" }}>Cancel</button>
              <button onClick={() => handleDelete(deleteId)} style={{ ...css.btn, flex:1, background:"#DC2626", color:"white" }}>🗑️ Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail view modal (kept from v2) */}
      {viewCfg && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"white", borderRadius:14, width:"100%", maxWidth:620, maxHeight:"88vh", overflowY:"auto", boxShadow:"0 8px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ background:"linear-gradient(135deg,#1a3c2e,#2A5C45)", padding:"16px 22px", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0 }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:"white" }}>{viewCfg.name}</div>
              <button onClick={() => setViewId(null)} style={{ background:"rgba(255,255,255,.15)", border:"none", borderRadius:6, padding:"4px 10px", color:"white", cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ padding:22 }}>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
                {viewCfg.examDate && <span style={{ fontSize:11, padding:"3px 10px", borderRadius:999, background:"#E0F2FE", color:"#0369A1", fontWeight:700 }}>📅 {viewCfg.examDate}</span>}
                {viewCfg.examMode && <span style={{ fontSize:11, padding:"3px 10px", borderRadius:999, background:"#EEF2FF", color:"#4338CA", fontWeight:700 }}>📝 {viewCfg.examMode}</span>}
              </div>
              {viewCfg.sessions?.filter(s=>s.time).length > 0 && (
                <div style={{ background:"#F8FAFC", borderRadius:8, padding:"10px 14px", marginBottom:14, border:"1px solid #E5E7EB" }}>
                  <div style={{ fontWeight:700, fontSize:11, color:"#6B7280", textTransform:"uppercase", marginBottom:6 }}>Sessions</div>
                  {viewCfg.sessions.map((s,i)=>(
                    <div key={i} style={{ fontSize:12, color:"#374151", marginBottom:3 }}><b>{s.label}</b>{s.time?` · ${s.time}`:""}</div>
                  ))}
                </div>
              )}
              {Object.entries(viewCfg.courseSubjects||{}).map(([c,subs])=>(
                <div key={c} style={{ marginBottom:12, background:"#F9FAFB", borderRadius:10, padding:"10px 14px", border:"1px solid #E5E7EB" }}>
                  <div style={{ fontWeight:700, color:"#1a3c2e", fontSize:13, marginBottom:6 }}>
                    {c} <span style={{ fontWeight:400, color:"#9CA3AF" }}>· {getTotalMarks(viewCfg,c)} marks</span>
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                    {subs.map(s=>(
                      <span key={s} style={{ fontSize:11, padding:"3px 10px", background:"#E0F2FE", color:"#0369A1", borderRadius:999, fontWeight:600 }}>
                        {s}{viewCfg.courseMaxMarks?.[c]?.[s]?<span style={{ opacity:.6 }}> /{viewCfg.courseMaxMarks[c][s]}</span>:null}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* NEW: Admit-card Preview */}
      {previewCfg && <ExamPreviewModal cfg={previewCfg} onClose={() => setPreviewCfg(null)} />}

      {/* ── Header ── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <h3 style={{ margin:0, fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:400, color:"#1C1A16" }}>🗂️ Exam Configurations</h3>
          <p style={{ margin:"4px 0 0", fontSize:12, color:"#9CA3AF" }}>{configs.length} formats available — {configs.find(c=>c.id===activeId)?.name || "none"} is active</p>
        </div>

        {/* Action bar: Create + Import */}
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
          {/* Hidden file input for import */}
          <input ref={importRef} type="file" accept=".json" style={{ display:"none" }} onChange={handleImportFile} />
          <button onClick={() => { setImportError(""); importRef.current?.click(); }}
            style={{ ...css.btn, background:"#F0FDF4", color:"#166534", border:"1px solid #BBF7D0", fontSize:13, padding:"9px 16px" }}>
            ⬆ Import JSON
          </button>
          <button onClick={() => { setEditingConfig(null); setShowBuilder(true); }}
            style={{ ...css.btn, background:"#1a3c2e", color:"white", fontSize:13, padding:"10px 20px" }}>
            ✏️ Create New Format
          </button>
        </div>
      </div>

      {/* Import error banner */}
      {importError && (
        <div style={{ background:"#FEF2F2", border:"1px solid #FECACA", color:"#DC2626", padding:"10px 16px", borderRadius:8, marginBottom:14, fontSize:13, display:"flex", justifyContent:"space-between" }}>
          <span>⚠️ {importError}</span>
          <button onClick={() => setImportError("")} style={{ background:"none", border:"none", color:"#DC2626", cursor:"pointer", fontWeight:700 }}>✕</button>
        </div>
      )}

      {switchDone && (
        <div style={{ background:"#F0FDF4", border:"1px solid #BBF7D0", color:"#166534", padding:"10px 16px", borderRadius:8, marginBottom:16, fontSize:13, fontWeight:600 }}>
          ✅ Configuration switched! All tabs now use the new mark scheme.
        </div>
      )}

      {/* ── Config cards ── */}
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(340px,1fr))", gap:14, marginBottom:24 }}>
        {configs.map(cfg => {
          const isActive = activeId === cfg.id;
          const isPreset = !!EXAM_CONFIG_PRESETS.find(p => p.id === cfg.id);
          const courses = Object.keys(cfg.courseSubjects || {});
          return (
            <div key={cfg.id} style={{
              background:"white", borderRadius:12,
              border: isActive ? "2px solid #1a3c2e" : "1.5px solid #E5E7EB",
              boxShadow: isActive ? "0 4px 16px rgba(26,60,46,0.12)" : "0 1px 4px rgba(0,0,0,0.06)",
              overflow:"hidden", position:"relative",
            }}>
              {isActive && <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:"linear-gradient(90deg,#1a3c2e,#2A5C45,#B8860B)" }} />}
              <div style={{ padding:"16px 18px 10px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6, gap:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14, color:"#1e293b" }}>{cfg.name}</div>
                    {cfg.description && <div style={{ fontSize:11, color:"#9CA3AF", marginTop:1 }}>{cfg.description}</div>}
                  </div>
                  <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                    {isActive
                      ? <span style={{ fontSize:11, padding:"2px 9px", borderRadius:999, background:"#E1F5EE", color:"#0F6E56", fontWeight:700 }}>✓ Active</span>
                      : <span style={{ fontSize:11, padding:"2px 9px", borderRadius:999, background:"#F1F5F9", color:"#64748b" }}>Inactive</span>
                    }
                    {isPreset && <span style={{ fontSize:10, padding:"2px 7px", borderRadius:999, background:"#EFF6FF", color:"#1D4ED8", fontWeight:700 }}>Built-in</span>}
                  </div>
                </div>

                <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
                  {cfg.examDate && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:999, background:"#EEF2FF", color:"#4338CA", fontWeight:600 }}>📅 {cfg.examDate}</span>}
                  {cfg.examMode && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:999, background:"#F5F3FF", color:"#7C3AED", fontWeight:600 }}>📝 {cfg.examMode}</span>}
                  {cfg.sessions?.length > 0 && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:999, background:"#FFF7ED", color:"#C2410C", fontWeight:600 }}>⏰ {cfg.sessions.length} session{cfg.sessions.length>1?"s":""}</span>}
                </div>

                <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:10 }}>
                  {courses.map(c => (
                    <div key={c} style={{ fontSize:11, padding:"3px 10px", borderRadius:999, background:"#F8FAFC", border:"1px solid #E5E7EB", color:"#374151" }}>
                      <span style={{ fontWeight:700, color:"#1a3c2e" }}>{c}</span>
                      <span style={{ color:"#9CA3AF", marginLeft:3 }}>{getTotalMarks(cfg,c)}m</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Card actions ── */}
              <div style={{ display:"flex", gap:6, padding:"10px 14px 14px", borderTop:"1px solid #F1F5F9", flexWrap:"wrap" }}>

                {/* Preview (NEW) */}
                <button onClick={() => setPreviewCfg(cfg)}
                  style={{ ...css.btn, padding:"7px 10px", background:"#EFF6FF", color:"#1D4ED8", border:"1px solid #BFDBFE", fontSize:12 }}>
                  🔍 Preview
                </button>

                {/* Export (NEW) */}
                <button onClick={() => handleExport(cfg)}
                  style={{ ...css.btn, padding:"7px 10px", background:"#F0FDF4", color:"#166534", border:"1px solid #BBF7D0", fontSize:12 }}>
                  ⬇ Export
                </button>

                {/* Duplicate (NEW) */}
                <button onClick={() => handleDuplicate(cfg)}
                  style={{ ...css.btn, padding:"7px 10px", background:"#FEFCE8", color:"#854D0E", border:"1px solid #FEF08A", fontSize:12 }}>
                  ⎘ Clone
                </button>

                {/* Edit — all configs; built-ins are cloned before editing */}
<button onClick={() => {
  const target = isPreset
    ? { ...cloneConfig(cfg), name: cfg.name }
    : cfg;
  setEditingConfig(target);
  setShowBuilder(true);
}}
  style={{ ...css.btn, padding:"7px 10px", background:"#F5F3FF", color:"#7C3AED", border:"1px solid #DDD6FE", fontSize:12 }}>
  ✏️ Edit
</button>

                {/* Activate / active label */}
                {isActive
                  ? <div style={{ flex:1, textAlign:"center", fontSize:12, color:"#0F6E56", fontWeight:600, padding:"7px 0", minWidth:100 }}>✓ Active</div>
                  : <button onClick={() => handleSwitch(cfg)} disabled={switching}
                      style={{ ...css.btn, flex:1, minWidth:100, background:switching?"#93C5FD":"#1a3c2e", color:"white", fontSize:13 }}>
                      {switching ? "⏳…" : "⚡ Activate"}
                    </button>
                }

                {/* Delete — only custom */}
                {!isPreset && (
                  <button onClick={() => setDeleteId(cfg.id)}
                    style={{ ...css.btn, padding:"7px 10px", background:"#FEF2F2", color:"#DC2626", border:"1px solid #FECACA", fontSize:12 }}>🗑️</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Info */}
      <div style={{ background:"#EFF6FF", border:"1px solid #BFDBFE", borderRadius:10, padding:"14px 18px", fontSize:13, color:"#1D4ED8" }}>
        <div style={{ fontWeight:700, marginBottom:6 }}>ℹ️ What you can do</div>
        <div style={{ color:"#374151", lineHeight:1.8 }}>
          <b>Create</b> — step-by-step wizard for new formats. &nbsp;
          <b>Clone</b> — duplicate any config (great for the next monthly test). &nbsp;
          <b>Edit</b> — modify your custom configs at any time. &nbsp;
          <b>Preview</b> — admit-card-style mark sheet. &nbsp;
          <b>Export</b> — download as <code>.json</code>. &nbsp;
          <b>Import</b> — load a <code>.json</code> file exported from another device or shared by a colleague. &nbsp;
          <b>Activate</b> — apply instantly across all tabs.
        </div>
      </div>
    </div>
  );
}

// ─── ROOT EXPORT ──────────────────────────────────────────────────────────────
export default function Exams({ currentUser, perms }) {
  const [tab, setTab]               = useState("entry");
  const [students, setStudents]     = useState([]);
  const [examTypes, setExamTypes]   = useState([]);
  const [courseSubjects, setCourseSubjects] = useState(DEFAULT_COURSE_SUBJECTS);
  const [schedule, setSchedule]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [institute, setInstitute]   = useState(INSTITUTE_DEFAULT);
  const [activeConfigId, setActiveConfigId] = useState("default");
 
  const refetchSchedule = useCallback(async () => {
    const { data } = await supabase.from('exam_schedule').select('*').order('exam_date');
    setSchedule(data || []);
  }, []);
 
  // Exams.jsx historically treats `class_name` as "the batch" (Achiever / Champion /
  // Umeed / etc). The Students module writes the real value to a column called
  // `batch`, not `class_name`. This normalizer maps batch → class_name on every
  // student record so the rest of this file (which reads s.class_name everywhere)
  // always sees the current, correct batch — without needing to touch 50+ call sites.
  const normalizeStudent = (s) => ({ ...s, class_name: s.batch || s.class_name || "" });

  useEffect(() => {
    ensureLibs();

    const loadData = async () => {
      const [{ data: sts }, { data: types }, { data: csSetting }, { data: sched }, { data: instSetting }] =
        await Promise.all([
          supabase.from("students").select("id,name,class_name,course,batch,admission_no,gcc_no").order("name"),
          supabase.from("exam_types").select("*").order("created_at"),
          supabase.from("system_settings").select("value").eq("key", "course_subjects").single(),
          supabase.from("exam_schedule").select("*").order("exam_date"),
          supabase.from("system_settings").select("value").eq("key", "exam_institute_config").single(),
        ]);

      setStudents((sts || []).map(normalizeStudent));
      setExamTypes(types && types.length ? types : [{ id: "default", name: "1st Monthly Test" }]);
      if (csSetting?.value)   { try { setCourseSubjects(JSON.parse(csSetting.value)); }   catch (_) {} }
      setSchedule(sched || []);
      if (instSetting?.value) { try { setInstitute({ ...INSTITUTE_DEFAULT, ...JSON.parse(instSetting.value) }); } catch (_) {} }
      setLoading(false);
    };

    loadData();

    // ── Realtime: keep the student list in sync with edits made in the
    // Students module (or anywhere else) without requiring a page refresh ──
    const studentsChannel = supabase
      .channel('exams:students-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'students' },
        (payload) => {
          setStudents(prev => {
            if (payload.eventType === 'INSERT') {
              return [...prev, normalizeStudent(payload.new)].sort((a, b) => (a.name || "").localeCompare(b.name || ""));
            }
            if (payload.eventType === 'UPDATE') {
              const merged = normalizeStudent(payload.new);
              return prev.map(s => s.id === merged.id ? { ...s, ...merged } : s);
            }
            if (payload.eventType === 'DELETE') {
              return prev.filter(s => s.id !== payload.old.id);
            }
            return prev;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(studentsChannel);
    };
  }, []);
 
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#F7F6F1", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Spinner />
      </div>
    );
  }
 
  const courses = Object.keys(courseSubjects);
 
  const handleCSVImportDone = async (importedMarks, course) => {
  const examTypeId = examTypes[0]?.id || "";
  const examDate   = new Date().toISOString().split("T")[0];
  const rows = [];

  for (const [key, markValue] of Object.entries(importedMarks)) {
    const student = students.find(s => key.startsWith(`${s.id}-`));
    if (!student) continue;
    const subject = key.slice(`${student.id}-`.length);

    const subjectMax = (COURSE_MAX_MARKS[course] || {})[subject] || 100;
    rows.push({
      student_id:   student.id,
      student_name: student.name,
      class_name:   student.class_name,
      exam_type_id: examTypeId,
      subject,
      marks:        Math.min(markValue, subjectMax),
      total_marks:  subjectMax,
      exam_date:    examDate,
    });
  }

  for (let i = 0; i < rows.length; i += 100) {
    await supabase
      .from("exam_marks")
      .upsert(rows.slice(i, i + 100), {
        onConflict: "student_id,exam_type_id,subject,exam_date",
      });
  }

  setTab("entry");
};
 
  // ── Section map ────────────────────────────────────────────────────────────
  const sectionMap = {
    dashboard:      <ExamDashboard courseSubjects={courseSubjects} examTypes={examTypes} students={students} institute={institute} schedule={schedule} />,
    toppers:        <ToppersCertificate courseSubjects={courseSubjects} examTypes={examTypes} students={students} institute={institute} />,
    entry:          <MarkEntry courseSubjects={courseSubjects} examTypes={examTypes} students={students} currentUser={currentUser} perms={perms} />,
 
    // ── NEW: smart CSV import tab ──────────────────────────────────────────
    csvimport: (
      <ExamCSVImport
        courseSubjects={courseSubjects}
        students={students}
        examTypes={examTypes}
        examDate={new Date().toISOString().split("T")[0]}
        examTypeId={examTypes[0]?.id || ""}
        isMobile={window.innerWidth < 768}
        onImportDone={handleCSVImportDone}
      />
    ),
    // ──────────────────────────────────────────────────────────────────────
 
    marks:          <MarksGrid courseSubjects={courseSubjects} examTypes={examTypes} students={students} />,
    analytics:      <Analytics courseSubjects={courseSubjects} examTypes={examTypes} students={students} />,
    rankings:       <Rankings courseSubjects={courseSubjects} examTypes={examTypes} students={students} />,
    merit:          <MeritList courseSubjects={courseSubjects} examTypes={examTypes} students={students} />,
    reportcard:     <ReportCards courseSubjects={courseSubjects} examTypes={examTypes} students={students} institute={institute} />,
    schedule:       <Schedule courseSubjects={courseSubjects} examTypes={examTypes} onScheduleChange={refetchSchedule} />,
    seatplan:       <SeatArrangement courseSubjects={courseSubjects} examTypes={examTypes} students={students} institute={institute} schedule={schedule} />,
    studentsmgr:    <StudentsTab courseSubjects={courseSubjects} students={students} onStudentsChange={setStudents} currentUser={currentUser} perms={perms} />,
    coursesubjects: <CourseSubjectsManager courseSubjects={courseSubjects} onUpdate={setCourseSubjects} />,
    examtypes:      <ExamTypesManager examTypes={examTypes} onUpdate={setExamTypes} />,
    examconfig: <ExamConfigManager courseSubjects={courseSubjects} onUpdate={setCourseSubjects} activeConfigId={activeConfigId} onConfigSwitch={(cfg) => { setActiveConfigId(cfg.id); window.__gnsiCourseMaxMarks = cfg.courseMaxMarks || {}; }} />,
    settings:       <ExamSettings institute={institute} onUpdateInstitute={setInstitute} />,
    progress:       <ProgressTab courseSubjects={courseSubjects} examTypes={examTypes} students={students} />,
    compare:        <CompareTab courseSubjects={courseSubjects} examTypes={examTypes} students={students} />,
    admitcard:      <AdmitCardsTab courseSubjects={courseSubjects} examTypes={examTypes} students={students} institute={institute} schedule={schedule} />,
    bulkreport:     <BulkReports courseSubjects={courseSubjects} examTypes={examTypes} students={students} institute={institute} schedule={schedule} />,
  };
 
  const activeTabInfo = TAB_GROUPS.flatMap(g => g.tabs).find(t => t.id === tab);
  const isMobile = window.innerWidth < 768;
 
  return (
    <div className="exams-root" style={{ minHeight: "100vh", background: "#F7F6F1", fontFamily: "'DM Sans','Inter',sans-serif" }}>
      <ExamHubHeader institute={institute} students={students} courses={courses} examTypes={examTypes} currentUser={currentUser} />
      <TabNav active={tab} onSelect={setTab} perms={perms} isAdmin={currentUser?.role === 'Admin'} />
      <div style={{ padding: isMobile ? "14px 12px" : "24px 28px", maxWidth: 1400 }}>
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 400, color: "#1C1A16" }}>
            {activeTabInfo?.icon} {activeTabInfo?.label}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9CA3AF" }}>{activeTabInfo?.tip}</p>
        </div>
        {sectionMap[tab]}
      </div>
    </div>
  );
}