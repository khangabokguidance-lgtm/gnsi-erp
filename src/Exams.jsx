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
  // Corrected to match this batch's actual exam papers (Mathematics-I,
  // Mathematics-II, Mental Ability, Passage, EVS — confirmed from real
  // result sheets) rather than the Sainik-style subject set this previously
  // held, which never matched what was actually being marked for this batch.
  "Combined Navodaya Course (Sainik Appearing Group)": ["Mathematics -I", "Mathematics - II", "Mental Ability", "Passage", "EVS"],
};

// ─── Track (real exam track) → Batches it contains ───────────────────────────
// IMPORTANT: throughout this file, the word "course" in variable names, picker
// labels, and courseSubjects keys (ACHIEVER, CHAMPION, LEADER, LAKSHYA, UMEED,
// PRIME, ELITE) actually means BATCH, not the student's real exam track. The
// `students.course` database column holds the real track instead (Sainik /
// Navodaya / Foundation / Combined Course). These two concepts share the word
// "course" but are NOT the same thing — never compare s.course against a
// courseSubjects-style batch value.
const TRACK_BATCHES = {
  Sainik:           ["ACHIEVER", "LEADER", "CHAMPION"],
  Navodaya:         ["LAKSHYA", "UMEED"],
  Foundation:       ["PRIME", "ELITE"],
  "Combined Course": ["Combined Navodaya Course (Sainik Appearing Group)"],
};
const TRACKS = Object.keys(TRACK_BATCHES);
function trackForBatch(batch) {
  const b = (batch || "").trim().toUpperCase();
  for (const t of TRACKS) {
    if (TRACK_BATCHES[t].some(x => x.toUpperCase() === b)) return t;
  }
  return "";
}

// ─── Max marks per subject per course (all total to 100) ─────────────────────
const COURSE_MAX_MARKS = {
  ACHIEVER:  { "English Grammar": 10, "Vocabulary": 10, "General Knowledge": 10, "Mathematics -I": 20, "Mathematics - II": 20, "Reasoning": 20, "Science": 10 },
  ELITE:     { "English Grammar": 20, "Science": 15, "Mathematics": 30, "Reasoning": 20, "Meitei Mayek": 15 },
  PRIME:     { "English Grammar": 20, "Science": 15, "Mathematics": 30, "Reasoning": 20, "Meitei Mayek": 15 },
  LAKSHYA:   { "Grammar": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  UMEED:     { "Grammar & Vocabulary": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  CHAMPION:  { "Vocabulary": 10, "General Knowledge": 10, "Mathematics-II": 20, "Mathematics - I": 20, "Reasoning": 20, "Grammar": 10, "Science": 10 },
  LEADER:    { "Vocabulary": 10, "Grammar": 10, "General Knowledge": 10, "Mathematics -I": 20, "Mathematics - II": 20, "Reasoning": 20, "Science": 10 },
  // Matches actual result sheets: each subject out of 20, totaling 100.
  "Combined Navodaya Course (Sainik Appearing Group)": { "Mathematics -I": 20, "Mathematics - II": 20, "Mental Ability": 20, "Passage": 20, "EVS": 20 },
};

function getCourseMax(course) {
  const maxMap = ((window.__gnsiCourseMaxMarks || COURSE_MAX_MARKS)[course]) || {};
  return Object.values(maxMap).reduce((s, v) => s + v, 0) || 100;
}

function getSubjectMax(course, subject) {
  return ((window.__gnsiCourseMaxMarks || COURSE_MAX_MARKS)[course] || {})[subject] || 100;
}

// ─── Fuzzy matching helpers for CSV/Excel student detection ──────────────────
function normalizeGccValue(v) {
  if (v === null || v === undefined) return "";
  const digits = String(v).replace(/[^0-9]/g, "");      // strip "GCC-", spaces, etc.
  return digits.replace(/^0+(?=\d)/, "");                 // strip leading zeros
}

function normalizeNameValue(name) {
  return String(name || "")
    .toUpperCase()
    .replace(/[.,'"_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function levenshteinRatio(a, b) {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length) || 1;
  return 1 - dist / maxLen;
}

// Score one token against another: exact match, single-letter-initial vs.
// prefix match, or fuzzy Levenshtein ratio for everything else.
function tokenPairScore(ta, tb) {
  if (ta === tb) return 1;
  if (ta.length === 1 && tb.startsWith(ta)) return 0.85;
  if (tb.length === 1 && ta.startsWith(tb)) return 0.85;
  return levenshteinRatio(ta, tb);
}

// Splits a short all-caps cluster like "PK" into ["P","K"] as an alternate
// tokenization, so squashed initials (teachers often type "PK BIDYALUXMI"
// for "Pukhrambam Kh. Bidyaluxmi") still get matched against DB tokens.
function expandInitialClusters(tokens) {
  const out = [];
  tokens.forEach(t => {
    if (t.length >= 2 && t.length <= 3 && /^[A-Z]+$/.test(t)) out.push(...t.split(""));
    else out.push(t);
  });
  return out;
}

// Greedy best-pairing between two token lists, weighted by token length so a
// strong match on a long distinctive token (e.g. a surname) outweighs a
// short/coincidental one, and each DB token can only be claimed once.
function pairAndScoreTokens(tokensA, tokensB) {
  if (!tokensA.length || !tokensB.length) return 0;
  const remaining = [...tokensB];
  let weightedSum = 0, weightSum = 0;
  const order = [...tokensA].sort((x, y) => y.length - x.length);
  for (const ta of order) {
    let bestIdx = -1, bestScore = -1;
    for (let i = 0; i < remaining.length; i++) {
      const s = tokenPairScore(ta, remaining[i]);
      if (s > bestScore) { bestScore = s; bestIdx = i; }
    }
    const weight = Math.max(ta.length, 1);
    weightedSum += Math.max(bestScore, 0) * weight;
    weightSum += weight;
    if (bestIdx !== -1 && bestScore > 0) remaining.splice(bestIdx, 1);
  }
  return weightSum ? weightedSum / weightSum : 0;
}

// Order-independent + typo-tolerant + initials-tolerant name similarity, 0..1.
//
// FIX: previously this sorted each name's words alphabetically, joined them
// back into one flat string, and ran whole-string Levenshtein on that pair.
// That approach silently fails whenever names have a different NUMBER of
// words (an initial like "M" vs a full middle name, or a missing/extra
// surname/suffix like "DEVI") — sorting+joining does not line matching
// words up against each other, so a genuinely strong single-token match
// (e.g. "BIDYALUXMI" appearing in both names) gets buried inside a long
// diffed string instead of being recognised as strong evidence on its own.
// This version tokenizes both names and pairs tokens up individually
// (longest/most distinctive tokens claim their best match first), plus
// tries an initials-expanded tokenization for squashed initials like "PK".
function nameSimilarity(a, b) {
  const na = normalizeNameValue(a), nb = normalizeNameValue(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const ta = na.split(" ").filter(Boolean);
  const tb = nb.split(" ").filter(Boolean);

  const plain = pairAndScoreTokens(ta, tb);
  const expanded = pairAndScoreTokens(expandInitialClusters(ta), tb);

  return Math.max(plain, expanded);
}

/**
 * Best-effort student detection for a CSV/Excel row.
 * Priority: exact GCC → exact admission no → exact name → fuzzy name.
 *
 * `matchPool` is normally the batch/course-scoped pool — keeping fuzzy NAME
 * matching scoped to it is deliberate, since it disambiguates the many
 * students across the school who share a first or last name.
 *
 * `fullPool`, if provided, is the whole unfiltered student list. GCC and
 * admission numbers are unique per student regardless of batch, so those
 * lookups always check `fullPool` first — a student tagged under the wrong
 * batch (mis-tagged, transferred, mid-move between batches) should still
 * resolve instantly on their ID instead of being invisible to the matcher
 * and falling through to an unrelated fuzzy name guess. If NAME matching
 * finds nothing good enough in the scoped pool, it also falls back to
 * searching `fullPool` rather than returning a weak in-batch guess — a
 * strong match in the "wrong" batch is far more useful than a coincidental
 * weak match in the "right" one, and usually just means the CSV's detected
 * course or the student's batch field needs a look.
 */
function findBestStudentMatch({ rawName, rawGcc, rawAdm, matchPool, fullPool }) {
  const idPool = (fullPool && fullPool.length) ? fullPool : matchPool;
  const crossBatch = (student) => idPool !== matchPool && !matchPool.some(s => s.id === student.id);

  const gccNorm = normalizeGccValue(rawGcc);
  if (gccNorm) {
    const hit = idPool.find(s => normalizeGccValue(s.gcc_no) === gccNorm);
    if (hit) return { student: hit, matchType: crossBatch(hit) ? "GCC (different batch)" : "GCC", confidence: 1 };
  }

  const admNorm = String(rawAdm || "").trim().toUpperCase();
  if (admNorm) {
    const hit = idPool.find(s => String(s.admission_no || "").trim().toUpperCase() === admNorm);
    if (hit) return { student: hit, matchType: crossBatch(hit) ? "Admission No. (different batch)" : "Admission No.", confidence: 1 };
  }

  if (!rawName) return { student: null, matchType: "none", confidence: 0, suggestion: null };

  const nameNorm = normalizeNameValue(rawName);
  const exact = matchPool.find(s => normalizeNameValue(s.name) === nameNorm);
  if (exact) return { student: exact, matchType: "Name (exact)", confidence: 1 };

  const THRESHOLD = 0.72;

  let best = null, bestScore = 0;
  for (const s of matchPool) {
    const score = nameSimilarity(rawName, s.name);
    if (score > bestScore) { bestScore = score; best = s; }
  }
  if (best && bestScore >= THRESHOLD) {
    return { student: best, matchType: "Name (fuzzy)", confidence: bestScore, suggestion: null };
  }

  if (fullPool && fullPool.length && fullPool !== matchPool) {
    let bestFull = null, bestFullScore = 0;
    for (const s of fullPool) {
      const score = nameSimilarity(rawName, s.name);
      if (score > bestFullScore) { bestFullScore = score; bestFull = s; }
    }
    if (bestFull && bestFullScore >= THRESHOLD) {
      return { student: bestFull, matchType: "Name (fuzzy, different batch)", confidence: bestFullScore, suggestion: null };
    }
    if (bestFullScore > bestScore) { best = bestFull; bestScore = bestFullScore; }
  }

  return { student: null, matchType: "none", confidence: bestScore, suggestion: best };
}

function MatchBadge({ matchType, confidence }) {
  const pct = Math.round((confidence || 0) * 100);
  let bg = "#E1F5EE", color = "#0F6E56", label = matchType;
  if (matchType === "Name (fuzzy)") {
    if (pct >= 90) { bg = "#FEF9E7"; color = "#92740C"; }
    else { bg = "#FCEBEB"; color = "#A32D2D"; }
    label = `Name ≈${pct}%`;
  } else if (matchType === "Name (fuzzy, different batch)") {
    bg = "#FEF3E2"; color = "#B45309";
    label = `Name ≈${pct}% · different batch`;
  } else if (matchType === "Name (exact)") {
    label = "Name match";
  } else if (matchType === "GCC (different batch)" || matchType === "Admission No. (different batch)") {
    bg = "#FEF3E2"; color = "#B45309";
    label = `${matchType.split(" (")[0]} · different batch`;
  } else if (matchType === "Manual") {
    bg = "#EEF2FF"; color = "#4338CA"; label = "Manual";
  } else if (matchType === "New") {
    bg = "#ECFDF5"; color = "#047857"; label = "New Student";
  }
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: bg, color, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

// ─── Fuzzy matching helpers for CSV/Excel SUBJECT COLUMN detection ────────────
/**
 * Greedy best-effort mapping of expected subject names -> spreadsheet column indices.
 * Pass 1: exact (case/space-insensitive) match.
 * Pass 2: fuzzy similarity match (typos, "Mathematics-I" vs "Mathematics -I", abbreviations, etc),
 *         assigned highest-confidence pairs first so no column or subject is double-claimed.
 * `excludedCols` should contain columns already used for name/GCC/admission/course.
 */
function findBestColumnMatches(importSubjects, headers, excludedCols) {
  const available = headers.map((_, idx) => idx).filter(idx => !excludedCols.has(idx));
  const result = importSubjects.map(sub => ({ sub, col: -1, matchType: "none", confidence: 0 }));
  const usedCols = new Set();

  // Pass 1: exact match
  result.forEach(r => {
    const idx = available.find(c => !usedCols.has(c) && headers[c]?.toLowerCase().trim() === r.sub.toLowerCase().trim());
    if (idx !== undefined) { r.col = idx; r.matchType = "Exact"; r.confidence = 1; usedCols.add(idx); }
  });

  // Pass 2: fuzzy match — score every remaining (subject, column) pair, assign best pairs first
  const COL_THRESHOLD = 0.55;
  const pairs = [];
  result.forEach(r => {
    if (r.col !== -1) return;
    available.forEach(c => {
      if (usedCols.has(c)) return;
      const score = nameSimilarity(r.sub, headers[c] || "");
      if (score >= COL_THRESHOLD) pairs.push({ r, c, score });
    });
  });
  pairs.sort((a, b) => b.score - a.score);
  pairs.forEach(({ r, c, score }) => {
    if (r.col !== -1 || usedCols.has(c)) return;
    r.col = c; r.matchType = "Fuzzy"; r.confidence = score; usedCols.add(c);
  });

  return result;
}

/** Build a {subject: marks} object for one raw spreadsheet row given a subject→column map. */
function extractSubMarksFromRow(row, subjectColMap) {
  const subMarks = {};
  (subjectColMap || []).forEach(({ sub, col }) => {
    if (col !== undefined && col !== -1 && row && row[col] !== undefined && row[col] !== "") {
      const v = Number(row[col]);
      if (!isNaN(v)) subMarks[sub] = v;
    }
  });
  return subMarks;
}

function ColumnMatchBadge({ matchType, confidence }) {
  const pct = Math.round((confidence || 0) * 100);
  let bg = "#E1F5EE", color = "#0F6E56", label = "Exact";
  if (matchType === "Fuzzy") {
    if (pct >= 80) { bg = "#FEF9E7"; color = "#92740C"; }
    else { bg = "#FCEBEB"; color = "#A32D2D"; }
    label = `≈${pct}%`;
  } else if (matchType === "Manual") {
    bg = "#EEF2FF"; color = "#4338CA"; label = "Manual";
  } else if (matchType === "none") {
    bg = "#FCEBEB"; color = "#A32D2D"; label = "Not found";
  }
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 700, background: bg, color, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
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
  if (role === 'Accounts' || role === 'Accountant') return { canEdit:true,  canDelete:false, canImport:true,  canPrint:true  }
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
    :root{--bg:#F0F4FF;--bg2:#DBEAFE;--border:#BFDBFE;--text:#1C1A16;--text2:#3b5ca8;--accent:#0f2d5e;--gold:#B8860B;}
    body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);padding:28px;-webkit-font-smoothing:antialiased;}
    .page{max-width:720px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);}
    .header{background:linear-gradient(135deg,#0f2d5e 0%,#1a4d8a 60%,#2563b0 100%);color:#fff;padding:28px 36px 22px;text-align:center;position:relative;}
    .header::after{content:'';display:block;position:absolute;bottom:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#B8860B,#f0c040,#B8860B);}
    .eyebrow{font-size:10px;letter-spacing:4px;text-transform:uppercase;color:rgba(255,255,255,.75);margin-bottom:6px;}
    .inst-name{font-family:'Playfair Display',Georgia,serif;font-size:24px;font-weight:400;margin-bottom:4px;}
    .inst-addr{font-size:12px;color:rgba(255,255,255,.75);}
    .exam-pill{display:inline-block;margin-top:10px;font-size:12px;font-weight:500;background:rgba(255,255,255,.15);border-radius:20px;padding:4px 16px;color:rgba(255,255,255,.9);}
    .body{padding:28px 36px;}
    .info-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:22px;font-size:13px;}
    .info-cell{padding:11px 16px;border-bottom:1px solid var(--border);border-right:1px solid var(--border);}
    .info-cell:nth-child(even){border-right:none;}
    .info-cell:nth-last-child(-n+2){border-bottom:none;}
    .info-label{font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:var(--text2);margin-bottom:3px;font-weight:600;}
    .info-value{font-weight:600;font-size:14px;}
    table{width:100%;border-collapse:collapse;border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:18px;}
    thead tr{background:#0f2d5e;color:#fff;}
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
    <button onclick="window.print()" style="padding:10px 24px;background:#0f2d5e;color:#fff;border:none;border-radius:8px;cursor:pointer;font-family:inherit;font-size:14px;">🖨️ Print / Save as PDF</button>
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

function TabNav({ active, onSelect, perms, isAdmin, currentUser }) {
  const isMobile = useMobile();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const SETUP_TABS = ["studentsmgr", "coursesubjects", "examtypes", "settings"];
  const WRITE_TABS = ["entry", "schedule", "seatplan"];
  const DOC_TABS   = ["admitcard", "reportcard", "bulkreport", "toppers"];

  // Accounts/Accountant and Manager can always reach Schedule, Mark Entry,
  // Seat Plan, and Setup screens — this is a role-based floor, not overridden
  // by a `perms` object that may under-grant these roles.
  const role = currentUser?.role;
  const roleCanEdit = role === 'Manager' || role === 'Accounts' || role === 'Accountant';

  const canShow = (tabId) => {
    if (isAdmin) return true;
    if (roleCanEdit && (SETUP_TABS.includes(tabId) || WRITE_TABS.includes(tabId))) return true;
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

function MarkEntry({ courseSubjects, examTypes, students, currentUser, perms, onStudentsChange, initialCourse, initialExamType, initialExamDate }) {
  const isMobile = useMobile();
  const perm = usePerm(currentUser, perms);
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(initialCourse || courses[0] || "");
  const [examType, setExamType] = useState(initialExamType || examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState(initialExamDate || new Date().toISOString().split("T")[0]);

  // ── Subjects for the CURRENTLY SELECTED exam (course + examType + examDate) come straight
  // from exam_schedule, not from the static Course Subjects config. The config can drift from
  // what was actually scheduled (subjects combined/split differently per sitting), so anchoring
  // marks entry to the schedule itself guarantees every subject lines up with a real exam_id —
  // no fuzzy matching, no "combined vs split" mismatches.
  const [scheduledSubjects, setScheduledSubjects] = useState([]); // [{id, subject, total_marks}]
  const [scheduleError, setScheduleError] = useState("");
  const subjects = scheduledSubjects.map(s => s.subject);
  const getSubMax = (sub) => {
    const found = scheduledSubjects.find(s => s.subject === sub);
    return found ? (Number(found.total_marks) || 100) : 100;
  };
  const courseMax = scheduledSubjects.reduce((sum, s) => sum + (Number(s.total_marks) || 0), 0) || 100;

  // Dropout students are excluded from new mark entry the same way
  // Attendance.jsx's Mark tab excludes them from daily roll call — a
  // status change, not a delete, so their already-entered marks stay in
  // exam_marks and remain fully visible in Analytics/Rankings/ReportCards/
  // ProgressTab/CompareTab/MeritList/MarksGrid, which intentionally do NOT
  // filter on status since a dropout student's earlier scores are real
  // history. Only this tab and AdmitCardsTab — the two "acting on the
  // current/upcoming sitting" tabs — exclude them.
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course.toUpperCase() && s.status !== "Dropout"
  );

  // Existing batches for a track — used to quick-pick a batch when registering a new student
  const batchesForTrack = (trackName) => {
    if (!trackName) return [];
    const canonical = TRACK_BATCHES[trackName] || [];
    const seen = new Set(
      students.filter(s => (s.course || "").trim() === trackName).map(s => (s.class_name || "").toUpperCase()).filter(Boolean)
    );
    return [...new Set([...canonical, ...seen])];
  };

  const [marks, setMarks] = useState({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [importMode, setImportMode] = useState(false);
  const [importRows, setImportRows] = useState([]);
  const [importErrors, setImportErrors] = useState([]);
  const [importInfo, setImportInfo] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importDone, setImportDone] = useState(false);
  const [manualSearch, setManualSearch] = useState({});   // { [errorIndex]: query string }
  const [manualOpenIdx, setManualOpenIdx] = useState(null); // which unmatched row has its search box open
  const [manualSearchFilter, setManualSearchFilter] = useState({}); // { [errorIndex]: { course?, batch? } }
  const [rawImport, setRawImport] = useState(null);       // { rows, headers } — kept so subject columns can be remapped after detection
  const [addNewOpenIdx, setAddNewOpenIdx] = useState(null);     // which unmatched row has its "add new student" form open
  const [newStudentForm, setNewStudentForm] = useState({ name: "", gcc_no: "", admission_no: "", track: "", batch: "" });
  const [addingStudent, setAddingStudent] = useState(false);
  const [addStudentError, setAddStudentError] = useState("");
  const [importSaveError, setImportSaveError] = useState("");
  const [lastImportSummary, setLastImportSummary] = useState(null); // persists after the import panel closes, so the save is never invisible
  const [absentSet, setAbsentSet] = useState(new Set());
  const fileInputRef = useRef(null);
  const [isDirty, setIsDirty] = useState(false); // true once any mark changes since last successful save
  const [pendingCourseChange, setPendingCourseChange] = useState(null); // { type: 'course'|'examType'|'examDate', value } — held until confirmed
  const [bulkFillValues, setBulkFillValues] = useState({}); // { [subject]: string } — the bulk-fill input per subject column

  // Loads the real exam_schedule rows for (course, examType), then loads any
  // exam_marks already saved against those exact exam_ids. This allows subjects
  // scheduled on different dates to all be entered in one view.
  // The exam_date picker now shows the EARLIEST exam date for reference, but doesn't
  // filter the schedule query — we get all subjects for this course's exam type.
  const loadScheduleAndMarks = useCallback(async (typeId, crs) => {
    if (!typeId || !crs) { setScheduledSubjects([]); setMarks({}); return; }
    setLoading(true);
    setScheduleError("");

    // Query by exam_type + course, NOT by date — allows multi-day exams
    const { data: schedData, error: schedErr } = await supabase
      .from("exam_schedule")
      .select("id, subject, total_marks, exam_date")
      .eq("exam_type_id", typeId)
      .eq("course", crs)
      .order("exam_date"); // Sort by date for UI clarity

    if (schedErr) {
      console.error("Failed to fetch exam_schedule:", schedErr);
      setScheduledSubjects([]); setMarks({}); setLoading(false);
      setScheduleError(schedErr.message || String(schedErr));
      return;
    }

    const schedSubs = schedData || [];
    setScheduledSubjects(schedSubs);

    if (!schedSubs.length) {
      setMarks({}); setLoading(false);
      setScheduleError(`No exam scheduled for ${crs} under this exam type. Create it in Exams → Schedule first.`);
      return;
    }

    const ids = students.filter(s =>
      (s.class_name || "").toUpperCase() === crs.toUpperCase()
    ).map(s => s.id);
    const examIds = schedSubs.map(s => s.id);
    if (!ids.length) { setMarks({}); setLoading(false); return; }

    const { data, error } = await supabase
      .from("exam_marks")
      .select("student_id, exam_id, marks_obtained")
      .in("student_id", ids)
      .in("exam_id", examIds);

    if (error) {
      console.error("Failed to fetch exam_marks:", error);
      setMarks({}); setLoading(false);
      return;
    }

    const examIdToSubject = {};
    schedSubs.forEach(s => { examIdToSubject[s.id] = s.subject; });
    const map = {};
    (data || []).forEach(r => {
      const sub = examIdToSubject[r.exam_id];
      if (sub) map[`${r.student_id}-${sub}`] = r.marks_obtained;
    });
    setMarks(map); setLoading(false); setIsDirty(false); setAbsentSet(new Set());
  }, [students]);

  useEffect(() => { loadScheduleAndMarks(examType, course); }, [examType, course, loadScheduleAndMarks]);

  // Warn on tab close/refresh if there are unsaved mark changes — standard
  // browser-level protection, same pattern used for any form with real data
  // entry risk. This can't intercept in-app navigation (switching tabs within
  // this app), which is handled separately by confirmSwitch() below.
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  // Guards against silently discarding unsaved marks when switching course,
  // exam type, or exam date — each of these triggers a fresh load that would
  // overwrite `marks` with whatever's already in the DB, losing anything
  // entered but not yet saved. Confirms first if dirty, otherwise switches
  // immediately.
  const confirmSwitch = (setter, value) => {
    if (isDirty) {
      if (!window.confirm("You have unsaved marks. Switching now will discard them. Continue anyway?")) return;
    }
    setter(value);
  };

  const handleMark = (sid, sub, val) => {
    const num = val === "" ? "" : Math.min(Number(val), getSubMax(sub));
    setMarks(p => ({ ...p, [`${sid}-${sub}`]: num }));
    setSaved(false);
    setIsDirty(true);
  };
  const toggleAbsent = (sid, sub) => {
    const key = `${sid}-${sub}`;
    setAbsentSet(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else { next.add(key); setMarks(p => ({ ...p, [key]: 0 })); setSaved(false); }
      return next;
    });
    setIsDirty(true);
  };
  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);
  const calcPctLocal = (total) => courseMax ? (total / courseMax) * 100 : 0;

  const handleSave = async () => {
    if (perm.canEdit === false && perm.canImport === false) {
      setSaveError("You don't have permission to save marks. Contact an Admin.");
      return;
    }
    setSaving(true);
    setSaveError("");
    
    try {
      if (!scheduledSubjects.length) {
        setSaving(false);
        setSaveError(`No exam scheduled for course="${course}" under this exam type. Create it in Exams → Schedule first.`);
        return;
      }
      
      const examIdBySubject = {};
      scheduledSubjects.forEach(s => { examIdBySubject[s.subject] = s.id; });
      
      // Build rows to insert — subjects already comes straight from scheduledSubjects,
      // so every lookup below is an exact match by construction. No fuzzy matching needed.
      // REPLACE this block in MarkEntry's handleSave():
const rows = [];
for (const st of courseStudents) {
  for (const sub of subjects) {
    const raw = marks[`${st.id}-${sub}`];
    if (raw === "" || raw === undefined || raw === null) continue;
    const m = Number(raw);
    if (!isNaN(m)) {
      const examId = examIdBySubject[sub];
      if (!examId) continue;
      rows.push({
        student_id: st.id,
        exam_id: examId,
        exam_type_id: examType,      // ← ADD THIS
        exam_date: examDate,          // ← ADD THIS
        subject: sub,                 // ← ADD THIS
        marks_obtained: m,
        marks: m,                     // ← ADD THIS (normalized)
        max_marks: getSubMax(sub),
        total_marks: getSubMax(sub),  // ← ADD THIS
        class_name: st.class_name,
      });
    }
  }
}
      
      if (!rows.length) {
        setSaving(false);
        setSaved(true);
        setIsDirty(false);
        setTimeout(() => setSaved(false), 3000);
        return;
      }
      
      // Upsert marks — use (student_id, exam_id) as the unique key
      const writeErrors = [];
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from("exam_marks").upsert(rows.slice(i, i + 100), { 
          onConflict: "student_id,exam_id" 
        });
        if (error) writeErrors.push(error.message || String(error));
      }
      
      if (writeErrors.length) {
        console.error("exam_marks upsert failed:", writeErrors, "rows:", rows);
        setSaving(false);
        setSaveError(writeErrors[0]);
        return;
      }
      
      setSaving(false); 
      setSaved(true);
      setIsDirty(false);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error("Save error:", err);
      setSaving(false);
      setSaveError(String(err?.message || err));
    }
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

    // Pull the REAL subject list for this course's scheduled exam (course + examType + examDate)
    // instead of the static Course Subjects config. This is what marks will actually be linked
    // to, so matching CSV headers against it guarantees an exact match every time — no fuzzy
    // matching, no "combined vs split subject" mismatches between config and schedule.
    const { data: schedRows, error: schedErr } = await supabase
      .from("exam_schedule")
      .select("id, subject, total_marks")
      .eq("exam_type_id", examType)
      .eq("exam_date", examDate)
      .eq("course", detectedCourse);

    if (schedErr || !schedRows?.length) {
      alert(`No exam scheduled for course="${detectedCourse}" on ${examDate}. Create the exam schedule first (Exams → Schedule), then try importing again.`);
      return;
    }

    const importSubjects = schedRows.map(s => s.subject);
    const examIdBySubject = {};
    const maxMarksBySubject = {};
    schedRows.forEach(s => { examIdBySubject[s.subject] = s.id; maxMarksBySubject[s.subject] = s.total_marks; });

    const nameCol = headers.findIndex(h => /name/i.test(h));
    const gccCol  = headers.findIndex(h => /gcc/i.test(h));
    const admCol  = headers.findIndex(h => /admission|adm|roll/i.test(h));
    if (nameCol === -1) { alert("Could not find a 'STUDENTS NAME' column."); return; }
    const excludedCols = new Set([nameCol, gccCol, admCol, courseCol].filter(c => c !== -1 && c !== undefined));
    const subjectColMap = findBestColumnMatches(importSubjects, headers, excludedCols);
    const allStudentsForCourse = students.filter(s => (s.class_name || "").toUpperCase() === detectedCourse.toUpperCase());
    const matchPool = allStudentsForCourse.length ? allStudentsForCourse : students;
    const matched = []; const errors = [];
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const rawName = row[nameCol]?.toString().trim(); if (!rawName) continue;
      const rawGcc = gccCol !== -1 ? row[gccCol]?.toString().trim() : "";
      const rawAdm = admCol !== -1 ? row[admCol]?.toString().trim() : "";
      const subMarks = extractSubMarksFromRow(row, subjectColMap);

      const { student, matchType, confidence, suggestion } = findBestStudentMatch({ rawName, rawGcc, rawAdm, matchPool, fullPool: students });

      if (!student) { errors.push({ rawName, rawGcc, rawAdm, subMarks, suggestion, rowIndex: i }); continue; }
      matched.push({ student, subMarks, matchType, confidence, rowIndex: i });
    }
    setImportRows(matched); setImportErrors(errors);
    setRawImport({ rows, headers });
    setImportInfo({ detectedCourse, subjects: importSubjects, subjectColMap, examIdBySubject, maxMarksBySubject });
    setImportMode(true); setImportDone(false);
    if (detectedCourse !== course) setCourse(detectedCourse);
  };

  const confirmImport = async () => {
    setImporting(true);
    setImportSaveError("");
    
    try {
      const importSubjects = importInfo?.subjects || subjects;
      const detCourse = importInfo?.detectedCourse || course;
      const examIdBySubject = importInfo?.examIdBySubject || {};
      const maxMarksBySubject = importInfo?.maxMarksBySubject || {};
      
      if (!Object.keys(examIdBySubject).length) {
        setImporting(false);
        setImportSaveError(`No exam schedule was resolved for this import. Re-upload the file to try again.`);
        return;
      }
      
      // Build rows to insert — examIdBySubject was resolved against the real exam_schedule
      // at upload time, so every subject here maps to exactly one exam_id. No fuzzy matching,
      // no risk of two subjects colliding onto the same exam.
      const rows = [];
      for (const { student: st, subMarks } of importRows) {
        for (const sub of importSubjects) {
          if (subMarks[sub] !== undefined) {
            const examId = examIdBySubject[sub];
            if (!examId) continue; // shouldn't happen — sub is drawn from the same schedule list
            rows.push({
              student_id: st.id,
              exam_id: examId,
              exam_type_id: examType,      // ← ADD
              exam_date: examDate,          // ← ADD
              subject: sub,  
              marks_obtained: subMarks[sub],
              marks: subMarks[sub],         // ← ADD
              max_marks: maxMarksBySubject[sub],
              total_marks: maxMarksBySubject[sub],  // ← ADD
              class_name: st.class_name,
            });
          }
        }
      }
      
      if (!rows.length) {
        setImporting(false);
        setImportDone(true);
        return;
      }
      
      // Upsert using (student_id, exam_id) as unique key
      const writeErrors = [];
      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabase.from("exam_marks").upsert(rows.slice(i, i + 100), { 
          onConflict: "student_id,exam_id" 
        });
        if (error) writeErrors.push(error.message || String(error));
      }
      
      if (writeErrors.length) {
        console.error("exam_marks upsert failed during CSV import:", writeErrors, "rows:", rows);
        setImporting(false);
        setImportSaveError(writeErrors[0]);
        return;
      }
      
      setImportSaveError("");

      // Auto-set course and exam date to match the import, then re-fetch
      setCourse(detCourse);
      setExamType(examType);
      await loadScheduleAndMarks(examType, examDate, detCourse);

      setImporting(false); 
      setImportDone(true);
      setLastImportSummary({
        course: detCourse,
        examTypeName: examTypes.find(e => e.id === examType)?.name || "Exam",
        examDate,
        studentCount: importRows.length,
        marksCount: rows.length,
        newStudentCount: importRows.filter(r => r.matchType === "New").length,
        savedAt: new Date(),
      });
    } catch (err) {
      console.error("Import error:", err);
      setImporting(false);
      setImportSaveError(String(err?.message || err));
    }
  };

  // Closes the import panel/preview. Does NOT touch lastImportSummary, so the
  // "what was saved & where" confirmation banner keeps showing afterwards.
  const closeImportPanel = () => {
    setImportMode(false); setImportRows([]); setImportErrors([]); setImportInfo(null); setImportDone(false);
    setManualSearch({}); setManualOpenIdx(null); setRawImport(null); setAddNewOpenIdx(null); setAddStudentError(""); setImportSaveError("");
  };

  // ─── Manual resolution for rows the auto-detector couldn't confidently match ──
  const assignStudentToError = (errIndex, student) => {
    const errRow = importErrors[errIndex];
    if (!errRow || !student) return;
    setImportRows(rows => [...rows, { student, subMarks: errRow.subMarks, matchType: "Manual", confidence: 1, rowIndex: errRow.rowIndex }]);
    setImportErrors(prev => prev.filter((_, i) => i !== errIndex));
    setManualOpenIdx(null);
    setAddNewOpenIdx(null);
    setManualSearch(prev => { const n = { ...prev }; delete n[errIndex]; return n; });
  };

  const dismissErrorRow = (errIndex) => {
    setImportErrors(prev => prev.filter((_, i) => i !== errIndex));
    setManualOpenIdx(null);
    setAddNewOpenIdx(null);
  };

  // ─── Register a brand-new student straight from an unmatched CSV/Excel row ──────
  const toggleAddStudentForm = (idx, err) => {
    if (addNewOpenIdx === idx) { setAddNewOpenIdx(null); return; }
    setManualOpenIdx(null);
    setAddStudentError("");
    const detCourse = importInfo?.detectedCourse || course;
    setNewStudentForm({
      name: (err.rawName || "").toUpperCase(),
      gcc_no: normalizeGccValue(err.rawGcc) || err.rawGcc || "",
      admission_no: err.rawAdm || "",
      course: detCourse,
      class_name: (detCourse || "").toUpperCase(),
    });
    setAddNewOpenIdx(idx);
  };

  const saveNewStudentFromError = async (idx) => {
    const errRow = importErrors[idx];
    if (!errRow) return;
    setAddStudentError("");
    const name = newStudentForm.name.trim();
    const gccRaw = newStudentForm.gcc_no.trim();
    const trackVal = newStudentForm.track;
    const batchVal = newStudentForm.batch.trim().toUpperCase();
    if (!name) { setAddStudentError("Name is required."); return; }
    if (!gccRaw) { setAddStudentError("GCC No. is required."); return; }
    if (!trackVal) { setAddStudentError("Track is required."); return; }
    if (!batchVal) { setAddStudentError("Batch is required."); return; }
    const gccNum = Number(normalizeGccValue(gccRaw) || gccRaw);
    if (isNaN(gccNum)) { setAddStudentError("GCC No. must contain digits."); return; }
    if (students.find(s => normalizeGccValue(s.gcc_no) === normalizeGccValue(gccRaw))) {
      setAddStudentError(`GCC No. ${gccRaw} already belongs to another student.`);
      return;
    }
    setAddingStudent(true);
    const payload = {
      name: name.toUpperCase(), gcc_no: gccNum,
      admission_no: newStudentForm.admission_no.trim() || null,
      course: trackVal, class_name: batchVal, batch: batchVal,
    };
    const { data, error } = await supabase.from("students").insert([payload]).select();
    setAddingStudent(false);
    if (error) { setAddStudentError(error.message); return; }
    const newStudent = data[0];
    onStudentsChange?.([...students, newStudent].sort((a, b) => (a.name || "").localeCompare(b.name || "")));
    setImportRows(rows => [...rows, { student: newStudent, subMarks: errRow.subMarks, matchType: "New", confidence: 1, rowIndex: errRow.rowIndex }]);
    setImportErrors(prev => prev.filter(e => e !== errRow));
    setAddNewOpenIdx(null);
    setManualOpenIdx(null);
  };

  // ─── Manual remap of a subject -> spreadsheet column (fixes a wrong/missing auto-detection) ──
  const remapSubjectColumn = (subjectName, newCol) => {
    if (!importInfo?.subjectColMap) return;
    const newMap = importInfo.subjectColMap.map(m =>
      m.sub === subjectName ? { ...m, col: newCol, matchType: newCol === -1 ? "none" : "Manual", confidence: newCol === -1 ? 0 : 1 } : m
    );
    setImportInfo(prev => ({ ...prev, subjectColMap: newMap }));
    if (!rawImport) return;
    setImportRows(rows => rows.map(r => ({ ...r, subMarks: extractSubMarksFromRow(rawImport.rows[r.rowIndex], newMap) })));
    setImportErrors(errs => errs.map(e => ({ ...e, subMarks: extractSubMarksFromRow(rawImport.rows[e.rowIndex], newMap) })));
  };

  const handleExport = async () => {
    await ensureLibs(); const XLSX = window.XLSX;
    const headers = ["Student", "Class", ...subjects, "Total", "%", "Grade"];
    const rows = courseStudents.map(st => {
      const total = getTotal(st.id);
      const pct = calcPctLocal(total);
      const g = getGrade(pct);
      return [st.name, st.class_name, ...subjects.map(s => marks[`${st.id}-${s}`] ?? ""), total, pct.toFixed(1) + "%", g.label];
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Marks");
    XLSX.writeFile(wb, `GNSI_${course}_Marks_${examDate}.xlsx`);
  };

  const filtered = courseStudents.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()));

  // Progress tracker: a student counts as "complete" once every scheduled
  // subject has a value entered (including 0 for a marked-absent subject) —
  // partial entries (some subjects filled, others blank) count as incomplete
  // so a clerk can see at a glance who still needs attention.
  const isStudentComplete = (sid) => subjects.length > 0 && subjects.every(sub => {
    const v = marks[`${sid}-${sub}`];
    return v !== "" && v !== undefined && v !== null;
  });
  const completeCount = courseStudents.filter(s => isStudentComplete(s.id)).length;
  const progressPct = courseStudents.length ? Math.round((completeCount / courseStudents.length) * 100) : 0;

  // Keyboard navigation across the mark-entry grid, Excel-style: arrow keys
  // move between cells, Enter moves down a row (staying in the same subject
  // column — the natural flow when entering one subject for everyone),
  // Tab/Shift+Tab move across subjects within the same student row (native
  // browser behavior, no override needed for those two). Refs are keyed by
  // "rowIndex-colIndex" against the CURRENTLY FILTERED list, since that's
  // what's actually rendered and navigable at any given moment.
  const cellRefs = useRef({});
  const setCellRef = (row, col) => (el) => { cellRefs.current[`${row}-${col}`] = el; };
  const focusCell = (row, col) => {
    const el = cellRefs.current[`${row}-${col}`];
    if (el) { el.focus(); el.select?.(); }
  };
  const handleCellKeyDown = (e, row, col) => {
    const maxRow = filtered.length - 1;
    const maxCol = subjects.length - 1;
    if (e.key === "ArrowDown" || (e.key === "Enter" && !e.shiftKey)) {
      e.preventDefault();
      if (row < maxRow) focusCell(row + 1, col);
    } else if (e.key === "ArrowUp" || (e.key === "Enter" && e.shiftKey)) {
      e.preventDefault();
      if (row > 0) focusCell(row - 1, col);
    } else if (e.key === "ArrowRight") {
      const input = e.target;
      // Only hijack ArrowRight when the cursor is already at the end of the
      // field's text — otherwise this would block normal cursor movement
      // while editing a multi-digit number.
      if (input.selectionStart === String(input.value).length && col < maxCol) {
        e.preventDefault();
        focusCell(row, col + 1);
      }
    } else if (e.key === "ArrowLeft") {
      const input = e.target;
      if (input.selectionStart === 0 && col > 0) {
        e.preventDefault();
        focusCell(row, col - 1);
      }
    }
  };

  // Bulk-fill: sets one value across every subject cell in a column, for all
  // currently-visible (filtered) students at once — e.g. giving everyone 0 for
  // a subject that was cancelled that day, or a flat baseline before manual
  // adjustments. Only touches students in the current filtered/search view,
  // so a search can scope a bulk-fill to a subset if needed.
  const applyBulkFill = (sub) => {
    const raw = bulkFillValues[sub];
    if (raw === undefined || raw === "") return;
    const val = Math.min(Number(raw), getSubMax(sub));
    if (isNaN(val)) return;
    if (!window.confirm(`Set "${sub}" to ${val} for all ${filtered.length} visible student(s)? This overwrites any existing value in this column.`)) return;
    setMarks(prev => {
      const next = { ...prev };
      filtered.forEach(st => { next[`${st.id}-${sub}`] = val; });
      return next;
    });
    setIsDirty(true);
    setSaved(false);
  };

  // Mobile: compact controls stacked
  const controlsStyle = isMobile
    ? { display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }
    : { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18, alignItems: "flex-end" };

  const ImportPreview = () => {
    const previewSubjects = importInfo?.subjects || subjects;
    const detCourse = importInfo?.detectedCourse || course;

    // Same pool the auto-detector used, for manual search/assignment of unmatched rows
    const manualPoolBase = students.filter(s => (s.class_name || "").toUpperCase() === detCourse.toUpperCase());
    const manualPool = manualPoolBase.length ? manualPoolBase : students;
    const assignedIds = new Set(importRows.map(r => r.student.id));

    // ── ENHANCED: Multi-strategy smart search ──────────────────────────────────
    // 1. Exact GCC match → score 1.0
    // 2. GCC substring match → score 0.95
    // 3. Exact admission no → score 1.0
    // 4. Exact name → score 1.0
    // 5. First/last name matches → score 0.85-0.9
    // 6. All words in name appear (fuzzy word match) → score 0.8
    // 7. Fuzzy string similarity → score varies
    // 8. Substring name match → score 0.75
    const getManualCandidates = (query, filterIdx) => {
      const q = (query || "").trim().toUpperCase();
      const filter = manualSearchFilter[filterIdx] || {};
      
      let pool = manualPool.filter(s => !assignedIds.has(s.id));
      
      // Apply batch filter (the "course" picker in this UI is actually a batch —
      // Achiever/Champion/etc — matched against class_name, not the students.course
      // column, which holds the real exam track (Sainik/Navodaya/Foundation/Combined).
      if (filter.batch) {
        pool = pool.filter(s => (s.class_name || "").toUpperCase() === filter.batch.toUpperCase());
      }
      
      if (!q) {
        // No query: return first 8 unassigned students (from filtered pool)
        return pool.slice(0, 8);
      }

      const scoredCandidates = pool.map(s => {
        let score = 0;
        let matchReason = "";

        const normGcc = normalizeGccValue(s.gcc_no);
        const normAdm = String(s.admission_no || "").trim().toUpperCase();
        const normName = normalizeNameValue(s.name);
        const ql = q.toLowerCase();

        // 1. Exact GCC match
        if (normalizeGccValue(q) && normalizeGccValue(q) === normGcc) {
          score = 1.0;
          matchReason = "GCC exact";
        }
        // 2. GCC substring/contains match
        else if (String(s.gcc_no).includes(q)) {
          score = 0.95;
          matchReason = "GCC substring";
        }
        // 3. Exact admission number match
        else if (normAdm && normAdm === q) {
          score = 1.0;
          matchReason = "Admission# exact";
        }
        // 4. Admission number partial match
        else if (normAdm && normAdm.includes(q)) {
          score = 0.92;
          matchReason = "Admission# partial";
        }
        // 5. Exact name match
        else if (normName === q) {
          score = 1.0;
          matchReason = "Name exact";
        }
        // 6. First or last name exact match
        else {
          const nameTokens = normName.split(" ").filter(Boolean);
          const queryTokens = q.split(" ").filter(Boolean);
          
          // 6a. First name exact match
          if (nameTokens[0] === queryTokens[0] && queryTokens.length === 1) {
            score = 0.88;
            matchReason = "First name";
          }
          // 6b. Last name exact match
          else if (nameTokens.length > 1 && queryTokens.length === 1 && 
                   nameTokens[nameTokens.length - 1] === queryTokens[0]) {
            score = 0.88;
            matchReason = "Last name";
          }
          // 7. All query tokens exist in name (word match)
          else if (queryTokens.every(qt => nameTokens.some(nt => nt === qt))) {
            score = 0.82;
            matchReason = "All words match";
          }
          // 8. Query tokens are substrings of name tokens (partial word match)
          else if (queryTokens.every(qt => nameTokens.some(nt => nt.includes(qt)))) {
            score = 0.75;
            matchReason = "Partial words";
          }
          // 9. Fuzzy string similarity on full name
          else {
            score = nameSimilarity(q, s.name);
            matchReason = score > 0.5 ? "Fuzzy match" : "Low match";
          }
          // 10. Substring check (catch-all)
          if (score < 0.5 && s.name?.toUpperCase().includes(ql)) {
            score = 0.65;
            matchReason = "Name contains";
          }
        }

        return { student: s, score, reason: matchReason };
      })
        .filter(({ score }) => score >= 0.45) // Slightly lower threshold to catch more matches
        .sort((a, b) => b.score - a.score)
        .slice(0, 10); // Show up to 10 results

      return scoredCandidates.map(({ student }) => student);
    };

    return (
      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.10)", padding: isMobile ? 14 : 24, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 600, color: "#1e293b" }}>📂 Import Preview</div>
          <button onClick={closeImportPanel}
            style={{ ...css.btn, padding: "5px 12px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", fontSize: 12 }}>
            {importDone ? "✕ Close" : "✕ Cancel"}
          </button>
        </div>
        {importInfo && (
          <div style={{ background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12 }}>
            <span style={{ fontWeight: 700, color: "#1D4ED8" }}>🎯 Auto-detected: </span>
            <span style={{ fontWeight: 800, color: "#1a3c2e", background: "#D1FAE5", padding: "2px 10px", borderRadius: 999 }}>{importInfo.detectedCourse}</span>
          </div>
        )}

        {/* ── Subject column mapping: which spreadsheet column feeds which subject ──── */}
        {importInfo?.subjectColMap?.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#374151", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>
              📊 Subject Column Mapping
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(260px,1fr))", gap: 8 }}>
              {importInfo.subjectColMap.map(({ sub, col, matchType, confidence }) => (
                <div key={sub} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: matchType === "none" ? "#FFFBEB" : "#F9FAFB", border: `1px solid ${matchType === "none" ? "#FDE68A" : "#E5E7EB"}`, borderRadius: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#1e293b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
                    <div style={{ fontSize: 10, color: "#9CA3AF" }}>/{importInfo?.maxMarksBySubject?.[sub] ?? getSubjectMax(detCourse, sub)} marks</div>
                  </div>
                  <ColumnMatchBadge matchType={matchType} confidence={confidence} />
                  <select
                    value={col}
                    onChange={e => remapSubjectColumn(sub, Number(e.target.value))}
                    style={{ fontSize: 11, padding: "4px 6px", borderRadius: 6, border: "1px solid #D1D5DB", maxWidth: 110 }}
                  >
                    <option value={-1}>— Not in file —</option>
                    {(rawImport?.headers || []).map((h, idx) => (
                      <option key={idx} value={idx}>{h || `Col ${idx + 1}`}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
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

        {/* ── Unmatched rows: search & manually assign, or skip ───────────────── */}
        {importErrors.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#92400E", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>
              ⚠️ {importErrors.length} row{importErrors.length > 1 ? "s" : ""} need manual matching
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
              {importErrors.map((err, idx) => {
                const isOpen = manualOpenIdx === idx;
                const isAddOpen = addNewOpenIdx === idx;
                const query = manualSearch[idx] ?? "";
                const candidates = getManualCandidates(query, idx);
                return (
                  <div key={idx} style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#1e293b" }}>{err.rawName || "(no name in row)"}</div>
                        <div style={{ fontSize: 11, color: "#9CA3AF" }}>
                          Row {err.rowIndex + 1}{err.rawGcc ? ` · GCC ${err.rawGcc}` : ""}
                          {err.suggestion && <span style={{ color: "#A16207" }}> · best guess: <b>{err.suggestion.name}</b></span>}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {err.suggestion && (
                          <button onClick={() => assignStudentToError(idx, err.suggestion)}
                            style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: "#FEF9E7", color: "#92740C", border: "1px solid #FDE68A" }}>
                            ✓ Use {err.suggestion.name.split(" ")[0]}
                          </button>
                        )}
                        <button onClick={() => { setAddNewOpenIdx(null); setManualOpenIdx(isOpen ? null : idx); }}
                          style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: isOpen ? "#1a3c2e" : "#EFF6FF", color: isOpen ? "white" : "#1D4ED8", border: isOpen ? "none" : "1px solid #BFDBFE" }}>
                          🔍 {isOpen ? "Close" : "Search"}
                        </button>
                        <button onClick={() => toggleAddStudentForm(idx, err)}
                          style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: isAddOpen ? "#16A34A" : "#ECFDF5", color: isAddOpen ? "white" : "#047857", border: isAddOpen ? "none" : "1px solid #BBF7D0" }}>
                          ➕ {isAddOpen ? "Close" : "Add New"}
                        </button>
                        <button onClick={() => dismissErrorRow(idx)}
                          style={{ ...css.btn, padding: "4px 8px", fontSize: 11, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
                          Skip
                        </button>
                      </div>
                    </div>
                    {isOpen && (
                      <div style={{ marginTop: 10, padding: "10px 12px", background: "#F9FAFB", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                        <input
                          autoFocus
                          value={query}
                          onChange={e => setManualSearch(p => ({ ...p, [idx]: e.target.value }))}
                          placeholder={err.rawGcc ? `GCC ${err.rawGcc} or name…` : (err.rawName ? `Similar to: ${err.rawName}…` : "Search: name, GCC, or admission#…")}
                          style={{ ...css.input, fontSize: 12, marginBottom: 8, width: "100%" }}
                        />
                        <div style={{ fontSize: 10, color: "#6B7280", marginBottom: 8, background: "white", padding: "6px 8px", borderRadius: 4 }}>
                          💡 Try: first/last name, GCC number, admission number, or partial name match
                        </div>
                        
                        {/* Quick filters */}
                        <div style={{ marginBottom: 10, paddingTop: 8, borderTop: "1px solid #E5E7EB" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase" }}>🎯 Filter by Batch:</div>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            <button 
                              onClick={() => setManualSearchFilter(p => ({ ...p, [idx]: {} }))}
                              style={{ ...css.btn, padding: "3px 8px", fontSize: 10, background: !manualSearchFilter[idx]?.batch ? "#1a3c2e" : "#F3F4F6", color: !manualSearchFilter[idx]?.batch ? "white" : "#374151", border: "none", borderRadius: 4 }}>
                              ✕ Clear
                            </button>
                            {courses.map(c => (
                              <button key={c}
                                onClick={() => setManualSearchFilter(p => ({ ...p, [idx]: { batch: manualSearchFilter[idx]?.batch === c ? undefined : c } }))}
                                style={{ ...css.btn, padding: "3px 8px", fontSize: 10, background: manualSearchFilter[idx]?.batch === c ? "#7c3aed" : "#F3F4F6", color: manualSearchFilter[idx]?.batch === c ? "white" : "#374151", border: manualSearchFilter[idx]?.batch === c ? "none" : "1px solid #E5E7EB", borderRadius: 4 }}>
                                {c}
                              </button>
                            ))}
                          </div>
                        </div>
                          {candidates.length > 0 ? (
                            candidates.map(s => {
                              // Re-compute match info for display
                              const q = manualSearch[idx]?.toUpperCase() || "";
                              const normGcc = normalizeGccValue(s.gcc_no);
                              const normAdm = String(s.admission_no || "").trim().toUpperCase();
                              const normName = normalizeNameValue(s.name);
                              
                              let matchBg = "#F0FDF4", matchColor = "#15803D", matchLabel = "";
                              if (normalizeGccValue(q) === normGcc) matchLabel = "GCC match";
                              else if (String(s.gcc_no).includes(q)) { matchLabel = "GCC substring"; matchBg = "#FEF3C7"; matchColor = "#92400E"; }
                              else if (normAdm === q) matchLabel = "Admission# exact";
                              else if (normAdm && normAdm.includes(q)) { matchLabel = "Admission# partial"; matchBg = "#FEF3C7"; matchColor = "#92400E"; }
                              else if (normName === q) matchLabel = "Name exact";
                              else matchLabel = "Partial match";

                              return (
                                <div key={s.id} onClick={() => assignStudentToError(idx, s)}
                                  style={{ padding: "8px 10px", borderRadius: 6, background: "white", border: "2px solid #E5E7EB", cursor: "pointer", fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all 0.15s", }}
                                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#3B82F6"; e.currentTarget.style.background = "#EFF6FF"; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#E5E7EB"; e.currentTarget.style.background = "white"; }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, color: "#1F2937", marginBottom: 2 }}>{s.name}</div>
                                    <div style={{ fontSize: 10, color: "#6B7280" }}>
                                      {s.gcc_no && <span>GCC {s.gcc_no}</span>}
                                      {s.admission_no && <span> · Adm# {s.admission_no}</span>}
                                      {(s.class_name || s.course) && <span> · {s.class_name || s.course}</span>}
                                    </div>
                                  </div>
                                  <span style={{ background: matchBg, color: matchColor, padding: "2px 8px", borderRadius: 999, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap", marginLeft: 8 }}>{matchLabel}</span>
                                </div>
                              );
                            })
                          ) : (
                            <div style={{ fontSize: 11, color: "#9CA3AF", padding: "8px 10px", textAlign: "center", background: "#F9FAFB", borderRadius: 6 }}>
                              <div style={{ marginBottom: 4 }}>🔍 No matching students found</div>
                              <div style={{ fontSize: 10, color: "#9CA3AF" }}>Try: name, GCC, or admission number</div>
                            </div>
                          )}
                        </div>
                    )}
                    {isAddOpen && (
                      <div style={{ marginTop: 10, padding: 12, background: "white", border: "1px solid #E5E7EB", borderRadius: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: "#1a3c2e", marginBottom: 8 }}>➕ Register as New Student</div>
                        {addStudentError && (
                          <div style={{ background: "#FEF2F2", color: "#DC2626", padding: "6px 10px", borderRadius: 6, fontSize: 11, marginBottom: 8 }}>⚠️ {addStudentError}</div>
                        )}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 100px", gap: 8, marginBottom: 8 }}>
                          <input value={newStudentForm.name} onChange={e => setNewStudentForm(p => ({ ...p, name: e.target.value }))}
                            placeholder="Full name" style={{ ...css.input, fontSize: 12 }} />
                          <input value={newStudentForm.gcc_no} onChange={e => setNewStudentForm(p => ({ ...p, gcc_no: e.target.value }))}
                            placeholder="GCC No." style={{ ...css.input, fontSize: 12 }} />
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", marginBottom: 4, textTransform: "uppercase" }}>Track</div>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {TRACKS.map(t => (
                              <button key={t} onClick={() => setNewStudentForm(p => ({ ...p, track: t, batch: TRACK_BATCHES[t][0] || p.batch }))}
                                style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: newStudentForm.track === t ? "#1a3c2e" : "#F3F4F6", color: newStudentForm.track === t ? "white" : "#374151", border: newStudentForm.track === t ? "none" : "1px solid #E5E7EB" }}>
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#6B7280", marginBottom: 4, textTransform: "uppercase" }}>Batch</div>
                          {batchesForTrack(newStudentForm.track).length > 0 && (
                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
                              {batchesForTrack(newStudentForm.track).map(b => (
                                <button key={b} onClick={() => setNewStudentForm(p => ({ ...p, batch: b }))}
                                  style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: newStudentForm.batch === b ? "#7c3aed" : "#F5F3FF", color: newStudentForm.batch === b ? "white" : "#5B21B6", border: newStudentForm.batch === b ? "none" : "1px solid #DDD6FE" }}>
                                  {b}
                                </button>
                              ))}
                            </div>
                          )}
                          <input value={newStudentForm.batch} onChange={e => setNewStudentForm(p => ({ ...p, batch: e.target.value }))}
                            placeholder="Batch / class name" style={{ ...css.input, fontSize: 12 }} />
                        </div>
                        <input value={newStudentForm.admission_no} onChange={e => setNewStudentForm(p => ({ ...p, admission_no: e.target.value }))}
                          placeholder="Admission No. (optional)" style={{ ...css.input, fontSize: 12, marginBottom: 10 }} />
                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={() => setAddNewOpenIdx(null)} style={{ ...css.btn, flex: 1, background: "#F3F4F6", color: "#374151", fontSize: 12 }}>Cancel</button>
                          <button onClick={() => saveNewStudentFromError(idx)} disabled={addingStudent}
                            style={{ ...css.btn, flex: 2, background: addingStudent ? "#93C5FD" : "#16A34A", color: "white", fontSize: 12 }}>
                            {addingStudent ? "⏳ Saving…" : "✅ Add & Use This Student"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}


        {/* Auto-rank every matched row (including newly-added students) by total marks obtained,
            same tie-aware logic as the Rankings / Merit List tabs: equal totals share a rank. */}
        {(() => {
          const rankedImportRows = importRows
            .map(r => ({ ...r, total: previewSubjects.reduce((s, sub) => s + (r.subMarks[sub] ?? 0), 0) }))
            .sort((a, b) => b.total - a.total);
          let _cr = 1, _pt = null;
          rankedImportRows.forEach((r, i) => {
            if (i === 0) { _cr = 1; _pt = r.total; }
            else if (r.total !== _pt) { _cr++; _pt = r.total; }
            r.rank = _cr;
          });
          const previewCourseMax = importInfo?.maxMarksBySubject
            ? previewSubjects.reduce((s, sub) => s + (Number(importInfo.maxMarksBySubject[sub]) || 0), 0) || getCourseMax(detCourse)
            : getCourseMax(detCourse);
          const medals = ["🥇", "🥈", "🥉"];
          return (
            <div style={{ overflowX: "auto", marginBottom: 16, maxHeight: 300, overflowY: "auto", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 500 }}>
                <thead style={{ position: "sticky", top: 0 }}>
                  <tr style={{ background: "#1a3c2e" }}>
                    <th style={{ padding: "8px 8px", textAlign: "center", color: "white", fontWeight: 700, whiteSpace: "nowrap" }}>Rank</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", color: "white", fontWeight: 700 }}>Student</th>
                    <th style={{ padding: "8px 8px", textAlign: "center", color: "white", fontWeight: 700, whiteSpace: "nowrap" }}>Matched By</th>
                    {previewSubjects.map(s => <th key={s} style={{ padding: "8px 8px", textAlign: "center", color: "white", fontWeight: 700, whiteSpace: "nowrap" }}>{s}</th>)}
                    <th style={{ padding: "8px 10px", textAlign: "center", color: "white", fontWeight: 700 }}>Total</th>
                    <th style={{ padding: "8px 10px", textAlign: "center", color: "white", fontWeight: 700 }}>%</th>
                  </tr>
                </thead>
                <tbody>
                  {rankedImportRows.map(({ student: st, subMarks, matchType, confidence, total, rank }, i) => {
                    const pct = previewCourseMax ? (total / previewCourseMax) * 100 : 0;
                    return (
                      <tr key={st.id} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "7px 8px", textAlign: "center", fontWeight: 800, color: rank <= 3 ? "#D97706" : "#9CA3AF", fontSize: rank <= 3 ? 14 : 12 }}>
                          {rank <= 3 ? medals[rank - 1] : `#${rank}`}
                        </td>
                        <td style={{ padding: "7px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>{st.name}</td>
                        <td style={{ padding: "7px 8px", textAlign: "center" }}><MatchBadge matchType={matchType} confidence={confidence} /></td>
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
                  {!rankedImportRows.length && (
                    <tr><td colSpan={previewSubjects.length + 5} style={{ padding: 24, textAlign: "center", color: "#94A3B8" }}>No matched rows yet — resolve unmatched rows above, or skip them.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        })()}
        <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: -10, marginBottom: 16 }}>
          Rank is computed live from marks obtained within this import batch — newly-added students are ranked automatically alongside everyone else.
        </div>

        {importSaveError && (
          <div style={{ background: "#FEF2F2", border: "1.5px solid #FECACA", color: "#991B1B", borderRadius: 10, padding: "14px 16px", marginBottom: 14, fontSize: 13 }}>
            <b>⚠ Import did not save:</b> {importSaveError}
            <div style={{ fontSize: 11.5, marginTop: 4, color: "#B91C1C" }}>Nothing was written to the database. Check your connection and try again — if this keeps happening, share this exact message.</div>
          </div>
        )}

        {importDone
          ? (
            <div style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: 10, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ fontSize: 26, lineHeight: 1 }}>✅</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, color: "#166534", fontSize: 14, marginBottom: 4 }}>Import saved successfully</div>
                  <div style={{ fontSize: 12.5, color: "#166534", lineHeight: 1.7 }}>
                    Saved <b>{lastImportSummary?.marksCount}</b> mark entr{lastImportSummary?.marksCount === 1 ? "y" : "ies"} for{" "}
                    <b>{lastImportSummary?.studentCount}</b> student{lastImportSummary?.studentCount !== 1 ? "s" : ""}
                    {lastImportSummary?.newStudentCount > 0 && (
                      <> (including <b>{lastImportSummary.newStudentCount}</b> newly-registered student{lastImportSummary.newStudentCount !== 1 ? "s" : ""})</>
                    )}
                    <br />
                    into <b>{lastImportSummary?.course}</b> · <b>{lastImportSummary?.examTypeName}</b> · <b>{lastImportSummary?.examDate}</b>
                  </div>
                  <div style={{ fontSize: 11, color: "#15803d", marginTop: 6 }}>
                    Saved at {lastImportSummary?.savedAt?.toLocaleTimeString()} · these marks are already written to the database — closing this panel just returns you to the Mark Entry table below, where you'll see them.
                  </div>
                </div>
              </div>
              <button onClick={closeImportPanel}
                style={{ ...css.btn, background: "#16A34A", color: "white", padding: "9px 20px", fontSize: 13, marginTop: 12, width: isMobile ? "100%" : "auto" }}>
                ✓ Done — Show Mark Entry Table
              </button>
            </div>
          )
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

      {/* Persistent confirmation of the last CSV/Excel import — stays visible even after the
          import panel is closed, so it's never unclear whether records were saved or vanished. */}
      {!importMode && lastImportSummary && (
        <div style={{ background: "#F0FDF4", border: "1.5px solid #86EFAC", borderRadius: 10, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <div style={{ fontSize: 18, lineHeight: 1.3 }}>✅</div>
            <div>
              <div style={{ fontWeight: 700, color: "#166534", fontSize: 13 }}>
                Last import: saved {lastImportSummary.marksCount} mark entr{lastImportSummary.marksCount === 1 ? "y" : "ies"} for {lastImportSummary.studentCount} student{lastImportSummary.studentCount !== 1 ? "s" : ""}
                {lastImportSummary.newStudentCount > 0 && ` (incl. ${lastImportSummary.newStudentCount} new)`}
              </div>
              <div style={{ fontSize: 11.5, color: "#15803d", marginTop: 2 }}>
                into <b>{lastImportSummary.course}</b> · <b>{lastImportSummary.examTypeName}</b> · <b>{lastImportSummary.examDate}</b> — at {lastImportSummary.savedAt?.toLocaleTimeString()}
              </div>
            </div>
          </div>
          <button onClick={() => setLastImportSummary(null)}
            style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: "transparent", color: "#166534", border: "1px solid #86EFAC" }}>
            ✕ Dismiss
          </button>
        </div>
      )}

      {/* Course picker */}
      <div style={{ ...css.card, background: "#F8FAFC", marginBottom: 14 }}>
        <CoursePicker courses={courses} value={course} onChange={c => confirmSwitch(setCourse, c)} />
        {subjects.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", gap: 5, flexWrap: "wrap" }}>
            {subjects.map(s => (
              <span key={s} style={{ fontSize: 11, padding: "3px 10px", background: "#E0F2FE", color: "#0369A1", borderRadius: 999, fontWeight: 600 }}>
                {s} <span style={{ opacity: 0.6 }}>/{getSubMax(s)}</span>
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
                <select value={examType} onChange={e => confirmSwitch(setExamType, e.target.value)} style={{ ...css.input }}>
                  {examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4, textTransform: "uppercase" }}>Date</label>
                <input type="date" value={examDate} onChange={e => confirmSwitch(setExamDate, e.target.value)} style={css.input} />
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
              <select value={examType} onChange={e => confirmSwitch(setExamType, e.target.value)} style={{ ...css.input, width: 180 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Date</label>
              <input type="date" value={examDate} onChange={e => confirmSwitch(setExamDate, e.target.value)} style={{ ...css.input, width: 160 }} />
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
      {saveError && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "10px 16px", borderRadius: 8, marginBottom: 14, fontSize: 13 }}>⚠ Save failed: {saveError}</div>}
      {scheduleError && <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E", padding: "10px 16px", borderRadius: 8, marginBottom: 14, fontSize: 13 }}>📋 {scheduleError}</div>}
      {importMode && <ImportPreview />}

      {!loading && subjects.length > 0 && courseStudents.length > 0 && (
        <div style={{ background: "white", borderRadius: 10, padding: "10px 16px", marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#6B7280", marginBottom: 4 }}>
              <span>Entry progress</span>
              <span style={{ fontWeight: 700, color: progressPct === 100 ? "#0F6E56" : "#374151" }}>{completeCount} / {courseStudents.length} students ({progressPct}%)</span>
            </div>
            <div style={{ height: 7, background: "#F1F5F9", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progressPct}%`, background: progressPct === 100 ? "#16A34A" : "#1a3c2e", borderRadius: 999, transition: "width .3s" }} />
            </div>
          </div>
          {isDirty && (
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>
              ● Unsaved changes
            </span>
          )}
        </div>
      )}

      {loading ? <Spinner /> : (
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? 12 : 13, minWidth: isMobile ? 500 : "auto" }}>
            <thead>
              <tr style={{ background: "#1a3c2e" }}>
                <th style={{ padding: isMobile ? "8px 10px" : "10px 14px", textAlign: "left", color: "white", fontWeight: 700, fontSize: isMobile ? 11 : 12, position: "sticky", left: 0, background: "#1a3c2e", zIndex: 2 }}>Student</th>
                {subjects.map(s => (
                  <th key={s} style={{ padding: "10px 6px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 10, whiteSpace: "nowrap" }}>
                    {s}<br /><span style={{ opacity: 0.6, fontWeight: 400, fontSize: 9 }}>/{getSubMax(s)}</span>
                  </th>
                ))}
                <th style={{ padding: "10px 8px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 11 }}>Total</th>
                <th style={{ padding: "10px 8px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 11 }}>%</th>
                <th style={{ padding: "10px 8px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 11 }}>Grd</th>
              </tr>
              {!isMobile && subjects.length > 0 && (
                <tr style={{ background: "#F0F4F2" }}>
                  <th style={{ padding: "6px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#6B7280", position: "sticky", left: 0, background: "#F0F4F2", zIndex: 2 }}>⚡ Bulk fill</th>
                  {subjects.map(sub => (
                    <th key={sub} style={{ padding: "4px 3px" }}>
                      <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                        <input type="number" min="0" max={getSubMax(sub)} placeholder="all"
                          value={bulkFillValues[sub] ?? ""}
                          onChange={e => setBulkFillValues(p => ({ ...p, [sub]: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter") applyBulkFill(sub); }}
                          style={{ width: 34, padding: "3px 2px", borderRadius: 5, border: "1px solid #D1D5DB", textAlign: "center", fontSize: 11 }} />
                        <button onClick={() => applyBulkFill(sub)} title={`Fill ${sub} for all visible students`}
                          style={{ ...css.btn, padding: "2px 5px", fontSize: 10, background: "#1a3c2e", color: "white" }}>✓</button>
                      </div>
                    </th>
                  ))}
                  <th colSpan={3}></th>
                </tr>
              )}
            </thead>
            <tbody>
              {filtered.map((st, i) => {
                const total = getTotal(st.id);
                const pct = calcPctLocal(total);
                const g = getGrade(pct);
                return (
                  <tr key={st.id} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: isMobile ? "6px 10px" : "8px 14px", position: "sticky", left: 0, background: i % 2 ? "#F9FAFB" : "white", zIndex: 1 }}>
                      <div style={{ fontWeight: 600, color: "#1e293b", fontSize: isMobile ? 11 : 13, whiteSpace: "nowrap" }}>{st.name}</div>
                      <div style={{ fontSize: 10, color: "#9CA3AF" }}>{st.class_name} · {st.gcc_no}</div>
                    </td>
                    {subjects.map((sub, colIdx) => {
                      const val = marks[`${st.id}-${sub}`];
                      const overMax = val !== "" && val !== undefined && Number(val) > getSubMax(sub);
                      return (
                      <td key={sub} style={{ padding: "5px 3px", textAlign: "center" }}>
                        <input type="number" min="0" max={getSubMax(sub)} placeholder="--"
                          ref={setCellRef(i, colIdx)}
                          value={val ?? ""}
                          onChange={e => handleMark(st.id, sub, e.target.value)}
                          onKeyDown={e => handleCellKeyDown(e, i, colIdx)}
                          style={{ width: isMobile ? 40 : 52, padding: "4px 2px", borderRadius: 6, border: overMax ? "1.5px solid #DC2626" : "1px solid #D1D5DB", textAlign: "center", fontSize: isMobile ? 12 : 13, outline: "none", background: overMax ? "#FEF2F2" : "white" }} />
                        <button onClick={() => toggleAbsent(st.id, sub)}
                          style={{ display: "block", margin: "2px auto 0", fontSize: 8, padding: "1px 4px", borderRadius: 3, border: "1px solid #FECACA", background: absentSet.has(`${st.id}-${sub}`) ? "#FCA5A5" : "#F9FAFB", color: absentSet.has(`${st.id}-${sub}`) ? "#DC2626" : "#9CA3AF", cursor: "pointer", fontWeight: 700 }}>
                          {absentSet.has(`${st.id}-${sub}`) ? "ABS" : "A"}
                        </button>
                      </td>
                      );
                    })}
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
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course.toUpperCase()
  );
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState("");
  const [marks, setMarks] = useState({});
  const [dates, setDates] = useState([]);
  const [datesLoaded, setDatesLoaded] = useState(false); // distinguishes "still checking" from "confirmed zero"
  const [loading, setLoading] = useState(false);
  // ── Real exam config, sourced live from exam_schedule for this exact course +
  // exam type — NOT the static courseSubjects/COURSE_MAX_MARKS config, which can
  // drift out of sync with whatever was actually scheduled and marked.
  const [scheduledSubjects, setScheduledSubjects] = useState([]); // [{ subject, total_marks }]

  useEffect(() => {
    if (!examType) return;
    setDatesLoaded(false);
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]); else setExamDate("");
      setDatesLoaded(true);
    });
  }, [examType]);

  useEffect(() => {
    if (!examType || !course) { setScheduledSubjects([]); return; }
    supabase.from("exam_schedule").select("id, subject, total_marks").eq("exam_type_id", examType).eq("course", course).order("exam_date").then(({ data }) => {
      setScheduledSubjects(data || []);
    });
  }, [examType, course]);

  const subjects = scheduledSubjects.length ? scheduledSubjects.map(s => s.subject) : (courseSubjects[course] || []);
  const subjectMaxMap = {};
  scheduledSubjects.forEach(s => { subjectMaxMap[s.subject] = s.total_marks; });
  const courseMax = scheduledSubjects.length
    ? scheduledSubjects.reduce((sum, s) => sum + (Number(s.total_marks) || 0), 0)
    : getCourseMax(course);

  useEffect(() => {
    if (!examType || !examDate) return;
    setLoading(true);
    const ids = courseStudents.map(s => s.id);
    // Resolve via exam_schedule (exam_id -> subject) rather than trusting the raw
    // `subject` text column on exam_marks, which can be null/stale on older rows.
    supabase.from("exam_schedule").select("id, subject").eq("exam_type_id", examType).eq("course", course).then(({ data: sched }) => {
        const examIdToSubject = {};
        (sched || []).forEach(s => { examIdToSubject[s.id] = s.subject; });
        const scopedExamIds = (sched || []).map(s => s.id);
        if (!scopedExamIds.length) { setMarks({}); setLoading(false); return; }
        supabase.from("exam_marks").select("student_id, exam_id, marks_obtained").eq("exam_type_id", examType).eq("exam_date", examDate).in("student_id", ids.length ? ids : ["__none__"]).in("exam_id", scopedExamIds).then(({ data }) => {
          const map = {};
          (data || []).forEach(r => {
            const sub = examIdToSubject[r.exam_id];
            if (sub) map[`${r.student_id}-${sub}`] = r.marks_obtained;
          });
          setMarks(map); setLoading(false);
        });
    });
  }, [examType, examDate, course]);

  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);
  const examName = examTypes.find(e => e.id === examType)?.name || "Examination";

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
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 160 }}>
            {!dates.length && <option value="">{datesLoaded ? "— No marks recorded —" : "Checking…"}</option>}
            {dates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>
      {datesLoaded && !dates.length && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "12px 16px", marginBottom: 14, fontSize: 12.5, color: "#92400E", lineHeight: 1.6 }}>
          ⚠️ No marks have been recorded yet under the exam type "<b>{examName}</b>". If marks were already imported or entered under what looks like this same exam type, there may be a <b>duplicate exam type with an identical name</b> pointing at a different record —
          check <b>Setup → Exam Types</b> for duplicates, or confirm the Exam Type used in Mark Entry matches this exact one.
        </div>
      )}
      {!scheduledSubjects.length && examType && course && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px", marginBottom: 14, fontSize: 12.5, color: "#991B1B", lineHeight: 1.6 }}>
          ⚠️ No exam is scheduled for <b>{course}</b> under "<b>{examName}</b>" — subjects and max marks below are falling back to the static Course Subjects config, which may not match what was actually entered. Set up the schedule in <b>Exams → Schedule</b> for accurate totals.
        </div>
      )}
      {loading ? <Spinner /> : (
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: isMobile ? 480 : "auto" }}>
            <thead><tr style={{ background: "#1a3c2e" }}>
              <th style={{ padding: "10px 14px", textAlign: "left", color: "white", fontWeight: 700, fontSize: 12, position: isMobile ? "sticky" : "static", left: 0, background: "#1a3c2e", zIndex: 2 }}>Student</th>
              {subjects.map(s => (
                <th key={s} style={{ padding: "10px 6px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 10, whiteSpace: "nowrap" }}>
                  {s}<br /><span style={{ opacity: 0.6, fontWeight: 400, fontSize: 9 }}>/{subjectMaxMap[s] || 100}</span>
                </th>
              ))}
              <th style={{ padding: "10px 8px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 11 }}>Total</th>
              <th style={{ padding: "10px 8px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 11 }}>%</th>
              <th style={{ padding: "10px 8px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 11 }}>Grd</th>
            </tr></thead>
            <tbody>
              {courseStudents.map((st, i) => {
                const total = getTotal(st.id);
                const pct = courseMax ? (total / courseMax) * 100 : 0;
                const g = getGrade(pct);
                return (
                  <tr key={st.id} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "8px 14px", fontWeight: 600, color: "#1e293b", position: isMobile ? "sticky" : "static", left: 0, background: i % 2 ? "#F9FAFB" : "white", zIndex: 1 }}>
                      {st.name}<div style={{ fontSize: 10, color: "#9CA3AF" }}>GCC {st.gcc_no}</div>
                    </td>
                    {subjects.map(sub => <td key={sub} style={{ padding: "8px 6px", textAlign: "center", fontSize: 12 }}>{marks[`${st.id}-${sub}`] ?? <span style={{ color: "#CBD5E1" }}>--</span>}</td>)}
                    <td style={{ padding: "8px 8px", textAlign: "center", fontWeight: 800 }}>{total}<span style={{ fontSize: 10, color: "#9CA3AF" }}>/{courseMax}</span></td>
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
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course.toUpperCase()
  );
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState("");
  const [marks, setMarks] = useState({});
  const [dates, setDates] = useState([]);
  const gradeRef = useRef(null); const subjectRef = useRef(null); const passRef = useRef(null);
  const chartsRef = useRef([]);
  // ── Real exam config, sourced live from exam_schedule for this exact course +
  // exam type — NOT the static courseSubjects/COURSE_MAX_MARKS config.
  const [scheduledSubjects, setScheduledSubjects] = useState([]); // [{ subject, total_marks }]

  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]);
    });
  }, [examType]);

  useEffect(() => {
    if (!examType || !course) { setScheduledSubjects([]); return; }
    supabase.from("exam_schedule").select("id, subject, total_marks").eq("exam_type_id", examType).eq("course", course).order("exam_date").then(({ data }) => {
      setScheduledSubjects(data || []);
    });
  }, [examType, course]);

  const subjects = scheduledSubjects.length ? scheduledSubjects.map(s => s.subject) : (courseSubjects[course] || []);
  const subjectMaxMap = {};
  scheduledSubjects.forEach(s => { subjectMaxMap[s.subject] = s.total_marks; });
  const courseMax = scheduledSubjects.length
    ? scheduledSubjects.reduce((sum, s) => sum + (Number(s.total_marks) || 0), 0)
    : getCourseMax(course);

  useEffect(() => {
    if (!examType || !examDate) return;
    const ids = courseStudents.map(s => s.id);
    // Resolve marks via exam_schedule (exam_id -> subject) instead of trusting the
    // raw `subject` text column on exam_marks directly — that column can be null/stale
    // on older rows or out of sync with the current schedule, which silently dropped
    // marks here even though Mark Entry (which joins via exam_id) could see them fine.
    supabase.from("exam_schedule").select("id, subject").eq("exam_type_id", examType).eq("course", course).then(({ data: sched }) => {
        const examIdToSubject = {};
        (sched || []).forEach(s => { examIdToSubject[s.id] = s.subject; });
        const scopedExamIds = (sched || []).map(s => s.id);
        if (!scopedExamIds.length) { setMarks({}); return; }
        supabase.from("exam_marks").select("student_id, exam_id, marks_obtained").eq("exam_type_id", examType).in("student_id", ids.length ? ids : ["__none__"]).in("exam_id", scopedExamIds).then(({ data }) => {
          const map = {};
          (data || []).forEach(r => {
            const sub = examIdToSubject[r.exam_id];
            if (sub) map[`${r.student_id}-${sub}`] = r.marks_obtained;
          });
          setMarks(map);
        });
    });
  }, [examType, course, examDate]);

  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);
  const getPct = total => courseMax ? (total / courseMax) * 100 : 0;
  const n = courseStudents.length || 1;

  const gradeCounts = {}; GRADE_PRESETS.forEach(g => { gradeCounts[g.label] = 0; });
  const subjectAvgPct = {}; const subjectPass = {};
  subjects.forEach(s => { subjectAvgPct[s] = 0; subjectPass[s] = 0; });

  courseStudents.forEach(st => {
    const pct = getPct(getTotal(st.id));
    const g = getGrade(pct); gradeCounts[g.label] = (gradeCounts[g.label] || 0) + 1;
    subjects.forEach(sub => {
      const m = Number(marks[`${st.id}-${sub}`]) || 0;
      const subMax = subjectMaxMap[sub] || 100;
      subjectAvgPct[sub] += (m / subMax) * 100;
      if ((m / subMax) * 100 >= 40) subjectPass[sub]++;
    });
  });
  subjects.forEach(s => { subjectAvgPct[s] = Math.round(subjectAvgPct[s] / n * 10) / 10; });

  const passed = courseStudents.filter(st => getPct(getTotal(st.id)) >= 40).length;
  const classAvg = (courseStudents.reduce((s, st) => s + getPct(getTotal(st.id)), 0) / n).toFixed(1);
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
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course.toUpperCase()
  );
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState("");
  const [marks, setMarks] = useState({});
  const [dates, setDates] = useState([]);
  // ── Real exam config, sourced live from exam_schedule for this exact course +
  // exam type — NOT the static courseSubjects/COURSE_MAX_MARKS config.
  const [scheduledSubjects, setScheduledSubjects] = useState([]);

  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]);
    });
  }, [examType]);

  useEffect(() => {
    if (!examType || !course) { setScheduledSubjects([]); return; }
    supabase.from("exam_schedule").select("id, subject, total_marks").eq("exam_type_id", examType).eq("course", course).order("exam_date").then(({ data }) => {
      setScheduledSubjects(data || []);
    });
  }, [examType, course]);

  const subjects = scheduledSubjects.length ? scheduledSubjects.map(s => s.subject) : (courseSubjects[course] || []);
  const courseMax = scheduledSubjects.length
    ? scheduledSubjects.reduce((sum, s) => sum + (Number(s.total_marks) || 0), 0)
    : getCourseMax(course);

  useEffect(() => {
    if (!examType || !examDate) return;
    const ids = courseStudents.map(s => s.id);
    // Resolve marks via exam_schedule (exam_id -> subject) instead of trusting the
    // raw `subject` text column on exam_marks directly — that column can be null/stale
    // on older rows or out of sync with the current schedule, which silently dropped
    // marks here even though Mark Entry (which joins via exam_id) could see them fine.
    supabase.from("exam_schedule").select("id, subject").eq("exam_type_id", examType).eq("course", course).then(({ data: sched }) => {
        const examIdToSubject = {};
        (sched || []).forEach(s => { examIdToSubject[s.id] = s.subject; });
        const scopedExamIds = (sched || []).map(s => s.id);
        if (!scopedExamIds.length) { setMarks({}); return; }
        supabase.from("exam_marks").select("student_id, exam_id, marks_obtained").eq("exam_type_id", examType).in("student_id", ids.length ? ids : ["__none__"]).in("exam_id", scopedExamIds).then(({ data }) => {
          const map = {};
          (data || []).forEach(r => {
            const sub = examIdToSubject[r.exam_id];
            if (sub) map[`${r.student_id}-${sub}`] = r.marks_obtained;
          });
          setMarks(map);
        });
    });
  }, [examType, course, examDate]);

  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);
  const ranked = [...courseStudents].map(st => ({ ...st, total: getTotal(st.id), pct: courseMax ? (getTotal(st.id) / courseMax) * 100 : 0 })).sort((a, b) => b.total - a.total);
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

      {!scheduledSubjects.length && examType && course && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px", marginBottom: 14, fontSize: 12.5, color: "#991B1B", lineHeight: 1.6 }}>
          ⚠️ No exam is scheduled for <b>{course}</b> under this exam type — totals/max marks are falling back to the static Course Subjects config. Set up the schedule in <b>Exams → Schedule</b> for accurate rankings.
        </div>
      )}

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
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course.toUpperCase()
  );
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [search, setSearch] = useState("");
  const [allMarks, setAllMarks] = useState([]);
  const [dates, setDates] = useState([]);
  const [loading, setLoading] = useState(false);
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  // ── Real exam config per exam_id, sourced live from exam_schedule for this course +
  // exam type — covers ALL dates under this exam type, since the schedule (and its max
  // marks) can legitimately differ from one monthly test date to the next.
  const [scheduledSubjects, setScheduledSubjects] = useState([]); // [{ id, subject, total_marks, exam_date }]

  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort();
      setDates(unique);
    });
  }, [examType]);

  useEffect(() => {
    if (!examType || !course) { setScheduledSubjects([]); return; }
    supabase.from("exam_schedule").select("id, subject, total_marks, exam_date").eq("exam_type_id", examType).eq("course", course).order("exam_date").then(({ data }) => {
      setScheduledSubjects(data || []);
    });
  }, [examType, course]);

  useEffect(() => {
    if (!selectedStudent || !examType || !dates.length) return;
    setLoading(true);
    supabase.from("exam_marks").select("student_id, exam_id, subject, marks_obtained, exam_date").eq("student_id", selectedStudent.id).eq("exam_type_id", examType).then(({ data }) => {
      setAllMarks(data || []); setLoading(false);
    });
  }, [selectedStudent, examType, dates]);

  // exam_id -> subject map, resolved from the live schedule rather than the raw
  // `subject` text column on exam_marks (which can be null/stale on older rows).
  // allMarks is fetched by student_id + exam_type_id only (see effect above),
  // so a dual-appearing student's marks from a DIFFERENT course under the same
  // exam type can be mixed in too. Only exam_ids that belong to the CURRENTLY
  // SELECTED course's schedule are kept — a row whose exam_id isn't in this
  // course's schedule is dropped rather than mislabeled with `|| r.subject`,
  // which previously let another course's mark silently masquerade as this
  // course's subject whenever the raw text happened to match (e.g. "Mathematics
  // I" existing in both an ACHIEVER schedule and a Combined Navodaya schedule).
  const examIdToSubject = {};
  scheduledSubjects.forEach(s => { examIdToSubject[s.id] = s.subject; });
  const resolvedMarks = allMarks
    .filter(r => examIdToSubject[r.exam_id] !== undefined)
    .map(r => ({ ...r, subject: examIdToSubject[r.exam_id] }));

  // Subjects for the chart legend: union across all scheduled dates for this exam type,
  // since a months-long trend can span schedule revisions.
  const subjects = [...new Set(scheduledSubjects.length ? scheduledSubjects.map(s => s.subject) : (courseSubjects[course] || []))];

  // Per-date max marks: each date's total is the sum of that date's own scheduled subjects,
  // not a single static course-level max — a given monthly test's config can differ from
  // another month's, and forcing them all to the same denominator silently distorts %.
  const maxByDate = {};
  scheduledSubjects.forEach(s => { maxByDate[s.exam_date] = (maxByDate[s.exam_date] || 0) + (Number(s.total_marks) || 0); });
  const fallbackCourseMax = getCourseMax(course);
  const courseMax = dates.length && maxByDate[dates[dates.length - 1]] ? maxByDate[dates[dates.length - 1]] : fallbackCourseMax;

  useEffect(() => {
    if (!chartRef.current || !selectedStudent || !dates.length) return;
    ensureLibs().then(() => {
      const Chart = window.Chart; if (!Chart) return;
      if (chartInstance.current) { try { chartInstance.current.destroy(); } catch (_) {} }
      const colors = ["#2A5C45","#185FA5","#7c3aed","#d97706","#0891b2","#e11d48","#84cc16"];
      const datasets = subjects.map((sub, i) => ({
        label: sub,
        data: dates.map(d => { const m = resolvedMarks.find(r => r.subject === sub && r.exam_date === d); return m ? m.marks_obtained : null; }),
        borderColor: colors[i % colors.length], backgroundColor: colors[i % colors.length] + "22",
        tension: 0.4, fill: false, pointRadius: 4, pointHoverRadius: 6, spanGaps: true,
      }));
      const totalsData = dates.map(d => {
        const dm = resolvedMarks.filter(r => r.exam_date === d);
        return dm.length ? dm.reduce((s, r) => s + (r.marks_obtained || 0), 0) : null;
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
  }, [allMarks, dates, selectedStudent, scheduledSubjects]);

  const filteredStudents = courseStudents.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()) || String(s.gcc_no).includes(search));
  const dateSummary = dates.map(d => {
    const dm = resolvedMarks.filter(r => r.exam_date === d);
    const total = dm.reduce((s, r) => s + (r.marks_obtained || 0), 0);
    const dMax = maxByDate[d] || fallbackCourseMax;
    const pct = dm.length ? (dMax ? (total / dMax) * 100 : 0) : null;
    return { date: d, total, max: dMax, pct, grade: pct !== null ? getGrade(pct) : null };
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
                            {subjects.map(sub => { const m = resolvedMarks.find(r => r.subject === sub && r.exam_date === d.date); return <td key={sub} style={{ padding: "8px 6px", textAlign: "center", color: m ? "#1e293b" : "#CBD5E1", fontSize: 12 }}>{m ? m.marks_obtained : "--"}</td>; })}
                            <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800 }}>{d.pct !== null ? `${d.total}/${d.max}` : "--"}</td>
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
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course.toUpperCase()
  );
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState("");
  const [dates, setDates] = useState([]);
  const [marks, setMarks] = useState({});
  const [selected, setSelected] = useState([]);
  const [search, setSearch] = useState("");
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const COMPARE_COLORS = ["#2A5C45","#185FA5","#7c3aed","#d97706"];
  // ── Real exam config, sourced live from exam_schedule for this exact course +
  // exam type — NOT the static courseSubjects/COURSE_MAX_MARKS config.
  const [scheduledSubjects, setScheduledSubjects] = useState([]);

  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]);
    });
  }, [examType]);

  useEffect(() => {
    if (!examType || !course) { setScheduledSubjects([]); return; }
    supabase.from("exam_schedule").select("id, subject, total_marks").eq("exam_type_id", examType).eq("course", course).order("exam_date").then(({ data }) => {
      setScheduledSubjects(data || []);
    });
  }, [examType, course]);

  const subjects = scheduledSubjects.length ? scheduledSubjects.map(s => s.subject) : (courseSubjects[course] || []);
  const subjectMaxMap = {};
  scheduledSubjects.forEach(s => { subjectMaxMap[s.subject] = s.total_marks; });
  const courseMax = scheduledSubjects.length
    ? scheduledSubjects.reduce((sum, s) => sum + (Number(s.total_marks) || 0), 0)
    : getCourseMax(course);

  useEffect(() => {
    if (!examType || !examDate) return;
    const ids = courseStudents.map(s => s.id);
    // Resolve marks via exam_schedule (exam_id -> subject) instead of trusting the
    // raw `subject` text column on exam_marks directly — that column can be null/stale
    // on older rows or out of sync with the current schedule, which silently dropped
    // marks here even though Mark Entry (which joins via exam_id) could see them fine.
    supabase.from("exam_schedule").select("id, subject").eq("exam_type_id", examType).eq("course", course).then(({ data: sched }) => {
        const examIdToSubject = {};
        (sched || []).forEach(s => { examIdToSubject[s.id] = s.subject; });
        const scopedExamIds = (sched || []).map(s => s.id);
        if (!scopedExamIds.length) { setMarks({}); return; }
        supabase.from("exam_marks").select("student_id, exam_id, marks_obtained").eq("exam_type_id", examType).in("student_id", ids.length ? ids : ["__none__"]).in("exam_id", scopedExamIds).then(({ data }) => {
          const map = {};
          (data || []).forEach(r => {
            const sub = examIdToSubject[r.exam_id];
            if (sub) map[`${r.student_id}-${sub}`] = r.marks_obtained;
          });
          setMarks(map);
        });
    });
  }, [examType, course, examDate]);

  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);
  const getPct = total => courseMax ? (total / courseMax) * 100 : 0;
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

      {!scheduledSubjects.length && examType && course && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px", marginBottom: 14, fontSize: 12.5, color: "#991B1B", lineHeight: 1.6 }}>
          ⚠️ No exam is scheduled for <b>{course}</b> under this exam type — totals/max marks are falling back to the static Course Subjects config.
        </div>
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
                  const total = getTotal(st.id); const pct = getPct(total); const g = getGrade(pct);
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
                            <td style={{ padding: "8px 8px", textAlign: "center", color: "#94A3B8", fontSize: 11 }}>{subjectMaxMap[sub] || 100}</td>
                            {selected.map((st, i) => { const m = Number(marks[`${st.id}-${sub}`]) || 0; const isTop = m === maxMark && m > 0;
                              return <td key={st.id} style={{ padding: "8px 10px", textAlign: "center", fontWeight: isTop ? 800 : 500, color: isTop ? COMPARE_COLORS[i] : "#374151" }}>{m}{isTop ? " 🏆" : ""}</td>; })}
                          </tr>
                        );
                      })}
                      <tr style={{ background: "#F0FDF4", borderTop: "2px solid #BBF7D0" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 800, color: "#1a3c2e", fontSize: isMobile ? 12 : 13 }}>TOTAL</td>
                        <td style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#94A3B8" }}>{courseMax}</td>
                        {selected.map((st, i) => { const total = getTotal(st.id); const pct = getPct(total); const maxTotal = Math.max(...selected.map(s => getTotal(s.id))); const isTop = total === maxTotal;
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
function ExamTypesManager({ examTypes, onUpdate, onSetupSchedule, courseSubjects, onScheduleChange }) {
  const isMobile = useMobile();
  const [list, setList] = useState(examTypes);
  const [form, setForm] = useState({ name: "", description: "" });
  const [saving, setSaving] = useState(false); const [saved, setSaved] = useState(false);
  const [addError, setAddError] = useState("");
  const [markCounts, setMarkCounts] = useState({}); // { exam_type_id: number of exam_marks rows }
  const [inspectId, setInspectId] = useState(null);     // exam_type_id currently being inspected, or null
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectRows, setInspectRows] = useState([]);
  const [lastAddedName, setLastAddedName] = useState("");
  const [autoFilling, setAutoFilling] = useState(null); // exam_type_id currently being auto-filled, or null
  const [autoFillResult, setAutoFillResult] = useState(null); // { id, message } after an attempt
  const [dupPreview, setDupPreview] = useState(null); // { examTypeId, groups: [{ course, subject, exam_date, rows, keepId }] } while confirming
  const [dupChecking, setDupChecking] = useState(null); // exam_type_id currently being checked
  const [dupCleaning, setDupCleaning] = useState(false);
  const [dupResult, setDupResult] = useState(null); // { id, message } after a cleanup
  const [includeCrossDate, setIncludeCrossDate] = useState(false); // whether cross-date repeats are included in the delete

  // Finds two categories of redundant exam_schedule rows for this exam type:
  //  1. Exact duplicates — same course + subject + exam_date. Always redundant, safe to
  //     auto-select for deletion.
  //  2. Cross-date repeats — same course + subject scheduled on MORE THAN ONE date. This
  //     can be a genuine re-sit/rescheduled exam, so these are shown separately and only
  //     deleted if the user explicitly opts in via the "also remove cross-date repeats"
  //     checkbox — never bundled silently into the exact-duplicate bucket.
  const checkDuplicateSchedule = async (examType) => {
    setDupChecking(examType.id);
    setDupResult(null);
    setIncludeCrossDate(false);
    const { data: rows } = await supabase.from("exam_schedule").select("*").eq("exam_type_id", examType.id);
    setDupChecking(null);

    const exactGroups = {};
    (rows || []).forEach(r => {
      const key = `${(r.course || "").toUpperCase()}|${(r.subject || "").toLowerCase()}|${r.exam_date}`;
      (exactGroups[key] = exactGroups[key] || []).push(r);
    });
    const exactDupGroups = Object.values(exactGroups).filter(g => g.length > 1);
    const exactWithKeep = exactDupGroups.map(g => {
      const sorted = [...g].sort((a, b) => String(a.id).localeCompare(String(b.id)));
      return { kind: "exact", course: sorted[0].course, subject: sorted[0].subject, exam_date: sorted[0].exam_date, rows: sorted, keepId: sorted[0].id };
    });

    // Cross-date: same course+subject appearing under more than one DISTINCT date —
    // computed on rows with exact duplicates already collapsed to one, so a subject
    // that's merely duplicated same-day doesn't also get flagged here.
    const collapsedRows = exactWithKeep.length
      ? (rows || []).filter(r => {
          const key = `${(r.course || "").toUpperCase()}|${(r.subject || "").toLowerCase()}|${r.exam_date}`;
          const grp = exactGroups[key];
          return grp.length === 1 || r.id === grp.sort((a, b) => String(a.id).localeCompare(String(b.id)))[0].id;
        })
      : (rows || []);
    const crossGroups = {};
    collapsedRows.forEach(r => {
      const key = `${(r.course || "").toUpperCase()}|${(r.subject || "").toLowerCase()}`;
      (crossGroups[key] = crossGroups[key] || []).push(r);
    });
    const crossDupGroups = Object.values(crossGroups).filter(g => g.length > 1);
    const crossWithKeep = crossDupGroups.map(g => {
      const sorted = [...g].sort((a, b) => a.exam_date.localeCompare(b.exam_date)); // keep earliest date
      return { kind: "cross", course: sorted[0].course, subject: sorted[0].subject, dates: sorted.map(r => r.exam_date), rows: sorted, keepId: sorted[0].id };
    });

    if (!exactWithKeep.length && !crossWithKeep.length) {
      setDupResult({ id: examType.id, ok: true, message: "No duplicate or repeated schedule entries found for this exam type." });
      return;
    }
    setDupPreview({ examTypeId: examType.id, examTypeName: examType.name, exactGroups: exactWithKeep, crossGroups: crossWithKeep });
  };

  const confirmCleanupDuplicates = async () => {
    if (!dupPreview) return;
    setDupCleaning(true);
    const idsToDelete = [
      ...dupPreview.exactGroups.flatMap(g => g.rows.filter(r => r.id !== g.keepId).map(r => r.id)),
      ...(includeCrossDate ? dupPreview.crossGroups.flatMap(g => g.rows.filter(r => r.id !== g.keepId).map(r => r.id)) : []),
    ];
    const { error } = await supabase.from("exam_schedule").delete().in("id", idsToDelete);
    setDupCleaning(false);
    if (error) { setDupResult({ id: dupPreview.examTypeId, ok: false, message: error.message }); setDupPreview(null); return; }
    setDupResult({ id: dupPreview.examTypeId, ok: true, message: `Removed ${idsToDelete.length} redundant entr${idsToDelete.length !== 1 ? "ies" : "y"}.` });
    setDupPreview(null);
    onScheduleChange?.();
  };

  // Auto-fills real exam_schedule rows for EVERY course covered by the Exam Config preset
  // whose name matches this exam type — unlike "Set up schedule" (which only opens the
  // config builder), this directly creates the schedule data Admit Cards / Report Cards /
  // Certificates all read from. Skips courses that already have schedule entries for this
  // exam type, so it's safe to click again after adding a course to the preset later.
  const autoFillSchedule = async (examType) => {
    const preset = EXAM_CONFIG_PRESETS.find(p => p.name.trim().toLowerCase() === examType.name.trim().toLowerCase());
    if (!preset) {
      setAutoFillResult({ id: examType.id, ok: false, message: `No Exam Config preset named "${examType.name}" exists yet. Use "Set up schedule" to create one first.` });
      return;
    }
    setAutoFilling(examType.id);
    setAutoFillResult(null);
    const today = new Date().toISOString().split("T")[0];
    const targetDate = preset.examDate || today;
    // Guard against duplicates by the exact combination that would make two rows
    // redundant — same course + subject + date — not just "this course has *something*
    // scheduled somewhere," which previously let a second full batch get inserted
    // alongside unrelated rows from a different Schedule mode (e.g. Auto-Generate,
    // which spreads subjects across separate days).
    const { data: existing } = await supabase.from("exam_schedule").select("course, subject, exam_date").eq("exam_type_id", examType.id);
    const existingKey = new Set((existing || []).map(s => `${(s.course || "").toUpperCase()}|${(s.subject || "").toLowerCase()}|${s.exam_date}`));
    const presetCourses = Object.keys(preset.courseSubjects || {});
    const rows = [];
    for (const course of presetCourses) {
      const subs = preset.courseSubjects[course] || [];
      const maxMap = preset.courseMaxMarks?.[course] || {};
      for (const subject of subs) {
        const key = `${course.toUpperCase()}|${subject.toLowerCase()}|${targetDate}`;
        if (existingKey.has(key)) continue; // this exact course+subject+date already exists — skip
        rows.push({
          exam_type_id: examType.id,
          course,
          subject,
          exam_date: targetDate,
          time: "09:00",
          shift: preset.sessions?.[0]?.label || "Morning",
          room: "",
          total_marks: maxMap[subject] || (courseSubjects && getSubjectMax(course, subject)) || 100,
        });
      }
    }
    if (!rows.length) {
      setAutoFilling(null);
      setAutoFillResult({ id: examType.id, ok: true, message: presetCourses.length ? `All courses already have schedule entries for ${targetDate}.` : "The matching preset has no courses/subjects defined." });
      return;
    }
    const { error } = await supabase.from("exam_schedule").insert(rows);
    setAutoFilling(null);
    if (error) { setAutoFillResult({ id: examType.id, ok: false, message: error.message }); return; }
    const coveredCourses = [...new Set(rows.map(r => r.course))];
    setAutoFillResult({ id: examType.id, ok: true, message: `Created ${rows.length} schedule entries on ${targetDate} across ${coveredCourses.length} course${coveredCourses.length !== 1 ? "s" : ""}: ${coveredCourses.join(", ")}.` });
    onScheduleChange?.();
  };

  // Fetch how many marks exist per exam type once, so duplicate (same-name) entries
  // can be told apart by which one actually holds data vs. which is an empty twin.
  useEffect(() => {
    supabase.from("exam_marks").select("exam_type_id").then(({ data }) => {
      const counts = {};
      (data || []).forEach(r => { counts[r.exam_type_id] = (counts[r.exam_type_id] || 0) + 1; });
      setMarkCounts(counts);
    });
  }, []);

  // Pulls the actual raw exam_marks rows for one exam type, so "which marks have I
  // uploaded" can be answered by looking directly at the database — no guessing.
  const toggleInspect = async (id) => {
    if (inspectId === id) { setInspectId(null); return; }
    setInspectId(id);
    setInspectLoading(true);
    const { data } = await supabase.from("exam_marks")
      .select("student_id, student_name, class_name, subject, marks, total_marks, exam_date")
      .eq("exam_type_id", id)
      .order("exam_date", { ascending: false });
    setInspectRows(data || []);
    setInspectLoading(false);
  };

  const add = async () => {
    setAddError("");
    const trimmed = form.name.trim();
    if (!trimmed) return;
    const dup = list.find(et => (et.name || "").trim().toLowerCase() === trimmed.toLowerCase());
    if (dup) {
      setAddError(`An exam type named "${trimmed}" already exists. Two exam types with the same name will silently behave like different records everywhere in the app (imports, report cards, etc. can end up pointing at different ones) — rename this one, or edit/delete the existing entry below instead.`);
      return;
    }
    setSaving(true);
    const { data } = await supabase.from("exam_types").insert([{ name: trimmed, description: form.description }]).select();
    if (data) { const updated = [...list, data[0]]; setList(updated); onUpdate(updated); setLastAddedName(trimmed); }
    setForm({ name: "", description: "" }); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2000);
  };
  const remove = async id => {
    if (!confirm("Delete this exam type?")) return;
    await supabase.from("exam_types").delete().eq("id", id);
    const updated = list.filter(e => e.id !== id); setList(updated); onUpdate(updated);
    if (inspectId === id) setInspectId(null);
  };

  // Group existing exam types by normalized name to surface any pre-existing duplicates.
  const nameGroups = {};
  list.forEach(et => {
    const key = (et.name || "").trim().toLowerCase();
    (nameGroups[key] = nameGroups[key] || []).push(et);
  });
  const duplicateGroups = Object.values(nameGroups).filter(g => g.length > 1);

  // Renders the raw-data breakdown for whichever exam type is currently being inspected.
  const InspectPanel = () => {
    if (inspectLoading) {
      return <div style={{ padding: 14, textAlign: "center", color: "#9CA3AF", fontSize: 12 }}>⏳ Loading marks from the database…</div>;
    }
    if (!inspectRows.length) {
      return <div style={{ padding: 14, textAlign: "center", color: "#9CA3AF", fontSize: 12 }}>No mark rows exist in the database for this exam type.</div>;
    }
    const byDate = {};
    inspectRows.forEach(r => {
      const d = r.exam_date || "(no date)";
      if (!byDate[d]) byDate[d] = { students: new Set(), subjects: new Set(), count: 0 };
      byDate[d].students.add(r.student_id);
      byDate[d].subjects.add(r.subject);
      byDate[d].count++;
    });
    const dateList = Object.entries(byDate).sort((a, b) => b[0].localeCompare(a[0]));
    return (
      <div style={{ marginTop: 10, background: "#FAFAFA", border: "1px solid #E5E7EB", borderRadius: 8, padding: 12 }}>
        <div style={{ fontWeight: 700, fontSize: 11, color: "#374151", textTransform: "uppercase", marginBottom: 8 }}>
          📊 {inspectRows.length} mark entr{inspectRows.length === 1 ? "y" : "ies"} found, across {dateList.length} date{dateList.length !== 1 ? "s" : ""}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
          {dateList.map(([date, info]) => (
            <div key={date} style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4, fontSize: 11.5, padding: "5px 10px", background: "white", border: "1px solid #E5E7EB", borderRadius: 6 }}>
              <span style={{ fontWeight: 700 }}>{date}</span>
              <span style={{ color: "#64748b" }}>{info.students.size} student{info.students.size !== 1 ? "s" : ""} · {info.subjects.size} subject{info.subjects.size !== 1 ? "s" : ""} · {info.count} entries</span>
            </div>
          ))}
        </div>
        <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: 6 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead style={{ position: "sticky", top: 0 }}>
              <tr style={{ background: "#1a3c2e" }}>
                {["Date", "Student", "Class", "Subject", "Marks"].map(h => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: "left", color: "white", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inspectRows.slice(0, 200).map((r, i) => (
                <tr key={i} style={{ background: i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "5px 8px", whiteSpace: "nowrap" }}>{r.exam_date}</td>
                  <td style={{ padding: "5px 8px", fontWeight: 600 }}>{r.student_name}</td>
                  <td style={{ padding: "5px 8px" }}>{r.class_name}</td>
                  <td style={{ padding: "5px 8px" }}>{r.subject}</td>
                  <td style={{ padding: "5px 8px", textAlign: "center", fontWeight: 700 }}>{r.marks}/{r.total_marks}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {inspectRows.length > 200 && (
            <div style={{ padding: "6px 10px", fontSize: 10, color: "#9CA3AF", textAlign: "center" }}>Showing first 200 of {inspectRows.length} rows.</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: isMobile ? "flex" : "grid", flexDirection: "column", gridTemplateColumns: "320px 1fr", gap: isMobile ? 14 : 20 }}>
      {dupPreview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "white", borderRadius: 14, width: "100%", maxWidth: 600, maxHeight: "85vh", overflowY: "auto", boxShadow: "0 8px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ background: "linear-gradient(135deg,#92400E,#B45309)", padding: "16px 22px", position: "sticky", top: 0 }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, color: "white" }}>🧹 Duplicate Schedule Entries</div>
              <div style={{ fontSize: 12, color: "rgba(255,255,255,.75)", marginTop: 2 }}>{dupPreview.examTypeName}</div>
            </div>
            <div style={{ padding: 20 }}>
              {dupPreview.exactGroups.length > 0 && (
                <>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>
                    Exact duplicates ({dupPreview.exactGroups.length}) — same course, subject, and date
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 }}>
                    {dupPreview.exactGroups.map((g, i) => (
                      <div key={i} style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px" }}>
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: "#92400E" }}>{g.course} · {g.subject}</div>
                        <div style={{ fontSize: 11.5, color: "#78350F", marginTop: 2 }}>
                          {g.exam_date} — {g.rows.length} copies found, keeping 1, deleting {g.rows.length - 1}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {dupPreview.crossGroups.length > 0 && (
                <>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: "#991B1B", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: 8 }}>
                    Same subject, different dates ({dupPreview.crossGroups.length})
                  </div>
                  <div style={{ fontSize: 11.5, color: "#7F1D1D", marginBottom: 10, lineHeight: 1.5 }}>
                    These could be a genuine re-sit or rescheduled exam — review before removing. Unchecked below, these are left alone.
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 14 }}>
                    {dupPreview.crossGroups.map((g, i) => (
                      <div key={i} style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "10px 14px" }}>
                        <div style={{ fontWeight: 700, fontSize: 12.5, color: "#991B1B" }}>{g.course} · {g.subject}</div>
                        <div style={{ fontSize: 11.5, color: "#7F1D1D", marginTop: 2 }}>
                          Found on: {g.dates.join(", ")} — would keep {g.rows[0].exam_date}, remove {g.rows.length - 1} other date{g.rows.length - 1 !== 1 ? "s" : ""}
                        </div>
                      </div>
                    ))}
                  </div>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#374151", marginBottom: 18, cursor: "pointer" }}>
                    <input type="checkbox" checked={includeCrossDate} onChange={e => setIncludeCrossDate(e.target.checked)} />
                    Also remove these cross-date repeats (keeping the earliest date for each)
                  </label>
                </>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setDupPreview(null)} style={{ ...css.btn, flex: 1, background: "#F3F4F6", color: "#374151" }}>Cancel</button>
                <button onClick={confirmCleanupDuplicates} disabled={dupCleaning}
                  style={{ ...css.btn, flex: 1, background: dupCleaning ? "#93C5FD" : "#DC2626", color: "white" }}>
                  {dupCleaning ? "⏳ Removing…" : `🗑️ Delete ${dupPreview.exactGroups.reduce((s, g) => s + g.rows.length - 1, 0) + (includeCrossDate ? dupPreview.crossGroups.reduce((s, g) => s + g.rows.length - 1, 0) : 0)} Rows`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={css.card}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 14 }}>➕ Add Exam Type</div>
        {addError && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>
            ⚠️ {addError}
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Name *</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. 1st Monthly Test" style={css.input} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Description</label>
          <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Optional" style={css.input} />
        </div>
        <SaveBtn onClick={add} saving={saving} saved={saved} label="Add Type" />
        {saved && lastAddedName && onSetupSchedule && (
          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 14px", marginTop: 12, fontSize: 12.5, color: "#166534" }}>
            ✅ "{lastAddedName}" added.{" "}
            <button onClick={() => onSetupSchedule(lastAddedName)} style={{ ...css.btn, padding: "3px 10px", fontSize: 11.5, background: "#166534", color: "white", marginLeft: 4 }}>
              🔗 Set up its schedule now
            </button>
          </div>
        )}
      </div>
      <div style={css.card}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 14 }}>⚙️ Configured Exam Types</div>

        {duplicateGroups.length > 0 && (
          <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 12.5, color: "#92400E" }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠️ Duplicate exam type name{duplicateGroups.length > 1 ? "s" : ""} found</div>
            <div style={{ marginBottom: 10, lineHeight: 1.5 }}>
              These share the exact same name but are different underlying records — selecting "the same" exam type by name in different tabs (e.g. Mark Entry vs. Report Cards) can silently point at different ones, making saved marks look like they vanished. Click <b>🔍 Inspect</b> on each to see its actual saved marks, keep whichever copy has the data, and delete the empty twin(s).
            </div>
            {duplicateGroups.map((group, gi) => (
              <div key={gi} style={{ marginBottom: gi < duplicateGroups.length - 1 ? 10 : 0 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>"{group[0].name}" — {group.length} copies</div>
                {group.map(et => {
                  const count = markCounts[et.id] || 0;
                  return (
                    <div key={et.id}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "6px 10px", background: "white", border: "1px solid #FDE68A", borderRadius: 6, marginBottom: 5, flexWrap: "wrap" }}>
                        <span style={{ fontFamily: "monospace", fontSize: 10.5, color: "#78716C", wordBreak: "break-all" }}>{et.id}</span>
                        <span style={{ fontWeight: 700, fontSize: 12, color: count ? "#0F6E56" : "#A32D2D", whiteSpace: "nowrap" }}>
                          {count ? `✓ ${count} mark${count !== 1 ? "s" : ""} recorded` : "0 marks — likely safe to delete"}
                        </span>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button onClick={() => toggleInspect(et.id)} style={{ ...css.btn, padding: "3px 10px", fontSize: 11, background: inspectId === et.id ? "#1a3c2e" : "#EFF6FF", color: inspectId === et.id ? "white" : "#1D4ED8", border: inspectId === et.id ? "none" : "1px solid #BFDBFE" }}>
                            🔍 {inspectId === et.id ? "Hide" : "Inspect"}
                          </button>
                          <button onClick={() => remove(et.id)} style={{ ...css.btn, padding: "3px 10px", fontSize: 11, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>🗑️ Delete</button>
                        </div>
                      </div>
                      {inspectId === et.id && <InspectPanel />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {list.map(et => (
          <div key={et.id} style={{ border: "1px solid #E5E7EB", borderRadius: 8, marginBottom: 8, background: "#F9FAFB", padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{et.name}</div>
                {et.description && <div style={{ fontSize: 11, color: "#9CA3AF" }}>{et.description}</div>}
                <div style={{ fontSize: 10, color: markCounts[et.id] ? "#0F6E56" : "#9CA3AF", marginTop: 2 }}>
                  {markCounts[et.id] ? `${markCounts[et.id]} mark${markCounts[et.id] !== 1 ? "s" : ""} recorded` : "no marks yet"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                <button onClick={() => toggleInspect(et.id)} style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: inspectId === et.id ? "#1a3c2e" : "#EFF6FF", color: inspectId === et.id ? "white" : "#1D4ED8", border: inspectId === et.id ? "none" : "1px solid #BFDBFE" }}>
                  🔍 {inspectId === et.id ? "Hide" : "Inspect"}
                </button>
                {onSetupSchedule && (
                  <button onClick={() => onSetupSchedule(et.name)} style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: "#F0FDF4", color: "#166534", border: "1px solid #BBF7D0" }}>
                    🔗 Set up schedule
                  </button>
                )}
                <button onClick={() => autoFillSchedule(et)} disabled={autoFilling === et.id}
                  style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: autoFilling === et.id ? "#93C5FD" : "#EEF2FF", color: "#4338CA", border: "1px solid #C7D2FE" }}>
                  {autoFilling === et.id ? "⏳ Filling…" : "⚡ Auto-fill Schedule"}
                </button>
                <button onClick={() => checkDuplicateSchedule(et)} disabled={dupChecking === et.id}
                  style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: dupChecking === et.id ? "#FDE68A" : "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}>
                  {dupChecking === et.id ? "⏳ Checking…" : "🧹 Clean up duplicates"}
                </button>
                <button onClick={() => remove(et.id)} style={{ ...css.btn, padding: "4px 10px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", fontSize: 12 }}>✕</button>
              </div>
            </div>
            {autoFillResult?.id === et.id && (
              <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, fontSize: 11.5, background: autoFillResult.ok ? "#F0FDF4" : "#FEF2F2", color: autoFillResult.ok ? "#166534" : "#991B1B", border: `1px solid ${autoFillResult.ok ? "#BBF7D0" : "#FECACA"}` }}>
                {autoFillResult.ok ? "✅ " : "⚠️ "}{autoFillResult.message}
              </div>
            )}
            {dupResult?.id === et.id && (
              <div style={{ marginTop: 8, padding: "8px 12px", borderRadius: 6, fontSize: 11.5, background: dupResult.ok ? "#F0FDF4" : "#FEF2F2", color: dupResult.ok ? "#166534" : "#991B1B", border: `1px solid ${dupResult.ok ? "#BBF7D0" : "#FECACA"}` }}>
                {dupResult.ok ? "✅ " : "⚠️ "}{dupResult.message}
              </div>
            )}
            {inspectId === et.id && <InspectPanel />}
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
function StudentsTab({ courseSubjects, students, examTypes, onStudentsChange, currentUser, perms, secondaryBatchMap, onSecondaryBatchesChange }) {
  const isMobile = useMobile();
  const perm = usePerm(currentUser, perms)
  const courses = Object.keys(courseSubjects); // NOTE: these are BATCH names (Achiever, Champion...), not real tracks

  // `track` = the real exam track (Sainik/Navodaya/Foundation/Combined Course), written to
  // students.course. `batch` = Achiever/Champion/etc, written to students.class_name + batch.
  const EMPTY_FORM = { name: "", gcc_no: "", admission_no: "", track: "", batch: courses[0] || "" };
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

  // ── Bulk selection (checkboxes in the list) ──────────────────────────────
  const [selectedIds, setSelectedIds] = useState(new Set());
  const toggleSelect = (id) => setSelectedIds(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const clearSelection = () => setSelectedIds(new Set());

  // ── Bulk action modals ───────────────────────────────────────────────────
  const [bulkChangeOpen, setBulkChangeOpen] = useState(false);   // change track/batch for selected
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);   // delete selected
  const [bulkAbsentOpen, setBulkAbsentOpen] = useState(false);   // find & remove exam-absent students
  const [secondaryBatchStudent, setSecondaryBatchStudent] = useState(null); // student currently managing secondary batch for
  const [bulkSecondaryOpen, setBulkSecondaryOpen] = useState(false); // bulk-add secondary batch to selected students
  const [batchCleanupOpen, setBatchCleanupOpen] = useState(false); // fix corrupted "Batch — SUFFIX" entries
  const [dupTagResolverOpen, setDupTagResolverOpen] = useState(false); // resolve students tagged into both ENG and MM sections

  // Existing batch values already in use (for quick-pick buttons). Track has no further
  // sub-hierarchy under it in the data — TRACK_BATCHES gives the canonical list per track,
  // but we also surface any batch values already seen in the data in case of stragglers.
  const batchesForTrack = (trackName) => {
    const canonical = TRACK_BATCHES[trackName] || [];
    const seen = new Set(
      students
        .filter(s => (s.course || "").trim() === trackName)
        .map(s => (s.class_name || "").toUpperCase())
        .filter(Boolean)
    );
    return [...new Set([...canonical, ...seen])];
  };

  const handleAdd = async () => {
    setError("");
    if (!form.name.trim())       { setError("Student name is required."); return; }
    if (!form.gcc_no.trim())     { setError("GCC No. is required."); return; }
    if (!form.track)             { setError("Track is required."); return; }
    if (!form.batch.trim())      { setError("Batch is required."); return; }
    if (students.find(s => String(s.gcc_no) === String(form.gcc_no).trim())) {
      setError(`GCC No. ${form.gcc_no} already exists.`); return;
    }
    setSaving(true);
    const batchVal = form.batch.trim();
    const payload = {
      name: form.name.trim().toUpperCase(), gcc_no: Number(form.gcc_no),
      admission_no: form.admission_no.trim() || null,
      course: form.track, class_name: batchVal.toUpperCase(), batch: batchVal,
    };
    const { data, error: sbErr } = await supabase.from("students").insert([payload]).select();
    if (sbErr) { setError(sbErr.message); setSaving(false); return; }
    onStudentsChange([...students, data[0]].sort((a, b) => a.name.localeCompare(b.name)));
    setForm(EMPTY_FORM); setSaving(false); setSaved(true);
    setTimeout(() => { setSaved(false); setView("list"); }, 1800);
  };

  const startEdit = (st) => {
    setEditId(st.id);
    setEditForm({
      name: st.name, gcc_no: st.gcc_no, admission_no: st.admission_no || "",
      track: st.course || trackForBatch(st.class_name) || "",
      batch: st.class_name || st.batch || "",
    });
  };
  const cancelEdit = () => { setEditId(null); setEditForm({}); };
  const saveEdit = async (id) => {
    setEditSaving(true);
    const batchVal = (editForm.batch || "").trim();
    const payload = {
      name: editForm.name.trim().toUpperCase(), gcc_no: Number(editForm.gcc_no),
      admission_no: editForm.admission_no || null,
      course: editForm.track || "", class_name: batchVal.toUpperCase(), batch: batchVal,
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
    const q = search.trim().toLowerCase();
    const matchSearch = !q || (s.name || "").toLowerCase().includes(q) || String(s.gcc_no ?? "").includes(q);
    const fc = filterCourse.trim().toUpperCase();
    const matchCourse = fc === "ALL" || (s.class_name || "").trim().toUpperCase() === fc;
    return matchSearch && matchCourse;
  });

  const statsPerCourse = courses.map(c => ({
    course: c,
    count: students.filter(s => (s.class_name || "").trim().toUpperCase() === c.trim().toUpperCase()).length,
    batches: batchesForTrack(trackForBatch(c)),
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
        {perm.canEdit && (
          <button onClick={() => { setView("import"); clearSelection(); }} style={{ ...css.btn, padding: "8px 20px", background: view === "import" ? "#1a3c2e" : "#F3F4F6", color: view === "import" ? "white" : "#374151" }}>
            📥 Import from CSV / Excel
          </button>
        )}
        {perm.canEdit && (
          <button onClick={() => { setView("resultimport"); clearSelection(); }} style={{ ...css.btn, padding: "8px 20px", background: view === "resultimport" ? "#1a3c2e" : "#F3F4F6", color: view === "resultimport" ? "white" : "#374151" }}>
            🧾 Import Result Sheet
          </button>
        )}
        {perm.canEdit && (
          <button onClick={() => { setView("secondaryimport"); clearSelection(); }} style={{ ...css.btn, padding: "8px 20px", background: view === "secondaryimport" ? "#1a3c2e" : "#F3F4F6", color: view === "secondaryimport" ? "white" : "#374151" }}>
            🔗📥 Import Secondary Batch
          </button>
        )}
        {perm.canEdit && (
          <button onClick={() => setBulkAbsentOpen(true)} style={{ ...css.btn, padding: "8px 20px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
            🚫 Find Exam-Absent Students
          </button>
        )}
        {perm.canEdit && (
          <button onClick={() => setBatchCleanupOpen(true)} style={{ ...css.btn, padding: "8px 20px", background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}>
            🧹 Fix Corrupted Batch Suffixes
          </button>
        )}
        {perm.canEdit && (
          <button onClick={() => setDupTagResolverOpen(true)} style={{ ...css.btn, padding: "8px 20px", background: "#F5F3FF", color: "#7c3aed", border: "1px solid #DDD6FE" }}>
            🔀 Resolve Duplicate Section Tags
          </button>
        )}
      </div>

      {bulkAbsentOpen && (
        <ExamAbsentFinder
          courseSubjects={courseSubjects}
          students={students}
          onStudentsChange={onStudentsChange}
          onClose={() => setBulkAbsentOpen(false)}
        />
      )}

      {batchCleanupOpen && (
        <BatchSuffixCleanupTool
          students={students}
          onStudentsChange={onStudentsChange}
          secondaryBatchMap={secondaryBatchMap}
          onSecondaryBatchesChange={onSecondaryBatchesChange}
          onClose={() => setBatchCleanupOpen(false)}
        />
      )}

      {dupTagResolverOpen && (
        <DuplicateSectionTagResolver
          students={students}
          secondaryBatchMap={secondaryBatchMap}
          onSecondaryBatchesChange={onSecondaryBatchesChange}
          onClose={() => setDupTagResolverOpen(false)}
        />
      )}

      {secondaryBatchStudent && (
        <SecondaryBatchModal
          student={secondaryBatchStudent}
          courseSubjects={courseSubjects}
          currentSecondaryBatches={secondaryBatchMap?.[secondaryBatchStudent.id] || []}
          onClose={() => setSecondaryBatchStudent(null)}
          onChanged={() => onSecondaryBatchesChange?.()}
        />
      )}

      {view === "import" && (
        <StudentRosterImport
          courseSubjects={courseSubjects}
          students={students}
          onStudentsChange={onStudentsChange}
          onDone={() => setView("list")}
        />
      )}

      {view === "resultimport" && (
        <ResultSheetImport
          courseSubjects={courseSubjects}
          students={students}
          examTypes={examTypes || []}
          onStudentsChange={onStudentsChange}
          onDone={() => setView("list")}
        />
      )}

      {view === "secondaryimport" && (
        <SecondaryBatchCSVImport
          courseSubjects={courseSubjects}
          students={students}
          onChanged={() => onSecondaryBatchesChange?.()}
          onDone={() => setView("list")}
        />
      )}

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
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase" }}>Track *</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {TRACKS.map(t => (
                    <button key={t} onClick={() => setForm(p => ({ ...p, track: t, batch: TRACK_BATCHES[t][0] || p.batch }))}
                      style={{ ...css.btn, padding: "6px 16px", fontSize: 12, background: form.track === t ? "#1a3c2e" : "#F3F4F6", color: form.track === t ? "white" : "#374151", border: form.track === t ? "none" : "1px solid #E5E7EB" }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase" }}>Batch *</label>
                {batchesForTrack(form.track).length > 0 && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
                    {batchesForTrack(form.track).map(b => (
                      <button key={b} onClick={() => setForm(p => ({ ...p, batch: b }))}
                        style={{ ...css.btn, padding: "5px 14px", fontSize: 12, background: form.batch === b ? "#7c3aed" : "#F5F3FF", color: form.batch === b ? "white" : "#5B21B6", border: form.batch === b ? "none" : "1px solid #DDD6FE" }}>
                        {b}
                      </button>
                    ))}
                  </div>
                )}
                <input value={form.batch} onChange={e => setForm(p => ({ ...p, batch: e.target.value }))} placeholder="Type batch name or pick above…" style={css.input} />
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
            {(search || filterCourse !== "ALL") && (
              <button onClick={() => { setSearch(""); setFilterCourse("ALL"); }}
                style={{ ...css.btn, padding: "5px 12px", fontSize: 11, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
                ✕ Reset filters
              </button>
            )}
          </div>

          {selectedIds.size > 0 && perm.canEdit && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "#EEF2FF", border: "1px solid #C7D2FE", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#4338CA" }}>{selectedIds.size} selected</span>
              <button onClick={() => setBulkChangeOpen(true)} style={{ ...css.btn, padding: "5px 12px", fontSize: 11, background: "#4338CA", color: "white" }}>
                🔁 Change Track / Batch
              </button>
              <button onClick={() => setBulkSecondaryOpen(true)} style={{ ...css.btn, padding: "5px 12px", fontSize: 11, background: "#7c3aed", color: "white" }}>
                🔗 Add Secondary Batch
              </button>
              {perm.canDelete && (
                <button onClick={() => setBulkDeleteOpen(true)} style={{ ...css.btn, padding: "5px 12px", fontSize: 11, background: "#DC2626", color: "white" }}>
                  🗑️ Remove Selected
                </button>
              )}
              <button onClick={clearSelection} style={{ ...css.btn, padding: "5px 12px", fontSize: 11, background: "#F3F4F6", color: "#374151" }}>
                ✕ Clear
              </button>
            </div>
          )}

          {bulkChangeOpen && (
            <BulkChangeCourseModal
              selectedIds={selectedIds}
              students={students}
              onStudentsChange={onStudentsChange}
              onClose={() => setBulkChangeOpen(false)}
              onDone={() => { setBulkChangeOpen(false); clearSelection(); }}
            />
          )}
          {bulkDeleteOpen && (
            <BulkDeleteModal
              selectedIds={selectedIds}
              students={students}
              onStudentsChange={onStudentsChange}
              onClose={() => setBulkDeleteOpen(false)}
              onDone={() => { setBulkDeleteOpen(false); clearSelection(); }}
            />
          )}
          {bulkSecondaryOpen && (
            <BulkSecondaryBatchModal
              selectedIds={selectedIds}
              students={students}
              courseSubjects={courseSubjects}
              secondaryBatchMap={secondaryBatchMap}
              onClose={() => setBulkSecondaryOpen(false)}
              onDone={() => { setBulkSecondaryOpen(false); clearSelection(); onSecondaryBatchesChange?.(); }}
            />
          )}

          <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: isMobile ? 520 : "auto" }}>
              <thead>
                <tr style={{ background: "#1a3c2e" }}>
                  <th style={{ padding: "10px 8px", textAlign: "center", width: 34 }}>
                    <input type="checkbox"
                      checked={filtered.length > 0 && filtered.every(s => selectedIds.has(s.id))}
                      onChange={e => {
                        if (e.target.checked) setSelectedIds(prev => new Set([...prev, ...filtered.map(s => s.id)]));
                        else setSelectedIds(prev => { const next = new Set(prev); filtered.forEach(s => next.delete(s.id)); return next; });
                      }} />
                  </th>
                  {["GCC No.", "Name", "Batch", "Track", "Adm. No.", "Actions"].map(h => (
                    <th key={h} style={{ padding: "10px 12px", textAlign: h === "Name" ? "left" : "center", color: "white", fontWeight: 700, fontSize: 11, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {!filtered.length && (
                  <tr>
                    <td colSpan={7} style={{ padding: "28px 12px", textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>
                      {students.length
                        ? <>No students match your current filters. <button onClick={() => { setSearch(""); setFilterCourse("ALL"); }} style={{ color: "#1a3c2e", fontWeight: 700, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>Reset filters</button> to see all {students.length}.</>
                        : "No students loaded yet."}
                    </td>
                  </tr>
                )}
                {filtered.map((st, i) => (
                  <tr key={st.id} style={{ background: selectedIds.has(st.id) ? "#EEF2FF" : (i % 2 ? "#F9FAFB" : "white"), borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "9px 8px", textAlign: "center" }}>
                      <input type="checkbox" checked={selectedIds.has(st.id)} onChange={() => toggleSelect(st.id)} />
                    </td>
                    {editId === st.id ? (
                      <>
                        <td style={{ padding: "6px 8px", textAlign: "center" }}><EditCell field="gcc_no" width={60} type="number" /></td>
                        <td style={{ padding: "6px 8px" }}><EditCell field="name" width={160} /></td>
                        <td style={{ padding: "6px 8px", textAlign: "center" }}><EditCell field="batch" width={80} /></td>
                        <td style={{ padding: "6px 8px", textAlign: "center" }}>
                          <select value={editForm.track || ""} onChange={e => setEditForm(p => ({ ...p, track: e.target.value }))} style={{ ...css.input, width: 110, fontSize: 12 }}>
                            <option value="">— Track —</option>
                            {TRACKS.map(t => <option key={t} value={t}>{t}</option>)}
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
                          {(secondaryBatchMap?.[st.id] || []).map(b => (
                            <div key={b} style={{ marginTop: 3 }}>
                              <span style={{ background: "#F5F3FF", color: "#7c3aed", padding: "1px 7px", borderRadius: 999, fontSize: 9.5, fontWeight: 700 }}>+ {b}</span>
                            </div>
                          ))}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "center" }}>
                          <span style={{ background: "#E1F5EE", color: "#0F6E56", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{st.course || "—"}</span>
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "center", color: "#94A3B8", fontSize: 12 }}>{st.admission_no || "—"}</td>
                        <td style={{ padding: "9px 12px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                            <button onClick={() => startEdit(st)} style={{ ...css.btn, padding: "4px 10px", background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE", fontSize: 11 }}>✏️</button>
                            {perm.canEdit && <button onClick={() => setSecondaryBatchStudent(st)} style={{ ...css.btn, padding: "4px 8px", background: "#F5F3FF", color: "#7c3aed", border: "1px solid #DDD6FE", fontSize: 11 }} title="Manage secondary batch (e.g. also appearing for Combined Navodaya)">🔗</button>}
                            {perm.canDelete && <button onClick={() => setDeleteId(st.id)} style={{ ...css.btn, padding: "4px 8px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", fontSize: 11 }}>🗑️</button>}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#94A3B8" }}>No students found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── BULK: Change Track / Batch for selected students ─────────────────────────
function BulkChangeCourseModal({ selectedIds, students, onStudentsChange, onClose, onDone }) {
  const selected = students.filter(s => selectedIds.has(s.id));
  const [track, setTrack] = useState("");
  const [batch, setBatch] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const batchOptions = track ? (TRACK_BATCHES[track] || []) : [];

  const apply = async () => {
    setErr("");
    if (!track && !batch.trim()) { setErr("Pick a track and/or type a batch to apply."); return; }
    setSaving(true);
    const payload = {};
    if (track) payload.course = track;
    if (batch.trim()) { payload.class_name = batch.trim().toUpperCase(); payload.batch = batch.trim(); }
    const ids = [...selectedIds];
    const { error } = await supabase.from("students").update(payload).in("id", ids);
    if (error) { setErr(error.message); setSaving(false); return; }
    onStudentsChange(students.map(s => selectedIds.has(s.id) ? { ...s, ...payload } : s));
    setSaving(false);
    onDone();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 14, padding: 24, maxWidth: 460, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 600, marginBottom: 6 }}>🔁 Change Track / Batch</div>
        <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 16 }}>
          Applying to <b>{selected.length}</b> selected student{selected.length === 1 ? "" : "s"}. Leave a field blank to keep it unchanged.
        </div>
        {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>⚠️ {err}</div>}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase" }}>New Track (optional)</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => setTrack("")} style={{ ...css.btn, padding: "5px 12px", fontSize: 12, background: track === "" ? "#1a3c2e" : "#F3F4F6", color: track === "" ? "white" : "#374151" }}>— Keep —</button>
            {TRACKS.map(t => (
              <button key={t} onClick={() => setTrack(t)} style={{ ...css.btn, padding: "5px 12px", fontSize: 12, background: track === t ? "#1a3c2e" : "#F3F4F6", color: track === t ? "white" : "#374151" }}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase" }}>New Batch (optional)</label>
          {batchOptions.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {batchOptions.map(b => (
                <button key={b} onClick={() => setBatch(b)} style={{ ...css.btn, padding: "5px 12px", fontSize: 12, background: batch === b ? "#7c3aed" : "#F5F3FF", color: batch === b ? "white" : "#5B21B6" }}>{b}</button>
              ))}
            </div>
          )}
          <input value={batch} onChange={e => setBatch(e.target.value)} placeholder="Leave blank to keep current batch" style={css.input} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ ...css.btn, flex: 1, background: "#F3F4F6", color: "#374151" }}>Cancel</button>
          <button onClick={apply} disabled={saving} style={{ ...css.btn, flex: 2, background: saving ? "#93C5FD" : "#1a3c2e", color: "white" }}>
            {saving ? "⏳ Applying…" : `✅ Apply to ${selected.length}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── BULK: Delete selected students ────────────────────────────────────────────
function BulkDeleteModal({ selectedIds, students, onStudentsChange, onClose, onDone }) {
  const selected = students.filter(s => selectedIds.has(s.id));
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [markDropoutInstead, setMarkDropoutInstead] = useState(true); // safer default: preserves marks history

  const apply = async () => {
    setErr("");
    setSaving(true);
    const ids = [...selectedIds];
    if (markDropoutInstead) {
      const { error } = await supabase.from("students").update({ status: "Dropout" }).in("id", ids);
      if (error) { setErr(error.message); setSaving(false); return; }
      onStudentsChange(students.map(s => selectedIds.has(s.id) ? { ...s, status: "Dropout" } : s));
    } else {
      const { error } = await supabase.from("students").delete().in("id", ids);
      if (error) { setErr(error.message); setSaving(false); return; }
      onStudentsChange(students.filter(s => !selectedIds.has(s.id)));
    }
    setSaving(false);
    onDone();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 14, padding: 24, maxWidth: 460, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ fontSize: 32, textAlign: "center", marginBottom: 8 }}>⚠️</div>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 600, textAlign: "center", marginBottom: 6 }}>Remove {selected.length} Student{selected.length === 1 ? "" : "s"}?</div>
        {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>⚠️ {err}</div>}
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10, padding: 12, marginBottom: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={markDropoutInstead} onChange={e => setMarkDropoutInstead(e.target.checked)} style={{ marginTop: 2 }} />
          <span style={{ fontSize: 12.5, color: "#374151" }}>
            <b>Mark as Dropout instead of deleting</b> — recommended. Keeps their name and past exam marks in history, but excludes them from active rosters, MarkEntry, and Admit Cards.
          </span>
        </label>
        {!markDropoutInstead && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 10 }}>
            Permanent delete removes the student record entirely. Their exam marks may become orphaned. This cannot be undone.
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={{ ...css.btn, flex: 1, background: "#F3F4F6", color: "#374151" }}>Cancel</button>
          <button onClick={apply} disabled={saving} style={{ ...css.btn, flex: 2, background: saving ? "#FCA5A5" : "#DC2626", color: "white" }}>
            {saving ? "⏳ Working…" : markDropoutInstead ? "✅ Mark as Dropout" : "🗑️ Delete Permanently"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SECONDARY BATCH (dual-appearing students, e.g. Sainik + Combined Navodaya) ──
// A student's primary batch lives in students.class_name (one value only) and
// their GCC No. is globally unique, so the same student can't literally occupy
// two class_name rows. This lets them appear in Mark Entry / Report Cards /
// Admit Cards / etc. under a SECOND batch too — writing to a small separate
// student_secondary_batches table — without duplicating the student row or
// GCC. The expansion into a second "phantom" entry (same real id, so marks
// always write against the correct student) happens once, centrally, in the
// top-level component via expandWithSecondaryBatches().
function SecondaryBatchModal({ student, courseSubjects, currentSecondaryBatches, onClose, onChanged }) {
  const allBatches = Object.keys(courseSubjects);
  const availableBatches = allBatches.filter(b => b !== student.class_name && !currentSecondaryBatches.includes(b));
  const [adding, setAdding] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [removingBatch, setRemovingBatch] = useState(null);

  const addSecondary = async () => {
    if (!adding) return;
    setErr(""); setSaving(true);
    const { error } = await supabase.from("student_secondary_batches").insert([{ student_id: student.id, batch: adding }]);
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setAdding("");
    onChanged();
  };

  const removeSecondary = async (batch) => {
    setErr(""); setRemovingBatch(batch);
    const { error } = await supabase.from("student_secondary_batches").delete().eq("student_id", student.id).eq("batch", batch);
    setRemovingBatch(null);
    if (error) { setErr(error.message); return; }
    onChanged();
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 14, padding: 24, maxWidth: 480, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 600, marginBottom: 4 }}>🔗 Secondary Batch</div>
        <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 16 }}>
          <b>{student.name}</b> (GCC {student.gcc_no}) is on the <b>{student.class_name}</b> roster. Add a second batch below if they're
          also appearing for another exam — e.g. a Sainik-batch student who is also sitting the Combined Navodaya exam. They'll show up
          in Mark Entry, Report Cards, and Admit Cards under both batches, using this same GCC No. — no duplicate student is created.
        </div>

        {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>⚠️ {err}</div>}

        {currentSecondaryBatches.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase" }}>Current Secondary Batch(es)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {currentSecondaryBatches.map(b => (
                <div key={b} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 8, padding: "7px 12px" }}>
                  <span style={{ fontSize: 12.5, color: "#5B21B6", fontWeight: 600 }}>{b}</span>
                  <button onClick={() => removeSecondary(b)} disabled={removingBatch === b}
                    style={{ ...css.btn, padding: "3px 10px", fontSize: 11, background: "white", color: "#DC2626", border: "1px solid #FECACA" }}>
                    {removingBatch === b ? "…" : "✕ Remove"}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase" }}>Add Another Batch</label>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={adding} onChange={e => setAdding(e.target.value)} style={{ ...css.input, flex: 1 }}>
              <option value="">— Select batch —</option>
              {availableBatches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <button onClick={addSecondary} disabled={!adding || saving} style={{ ...css.btn, background: saving ? "#93C5FD" : "#7c3aed", color: "white", padding: "8px 18px" }}>
              {saving ? "…" : "+ Add"}
            </button>
          </div>
          {!availableBatches.length && <div style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 6 }}>No other batches available to add.</div>}
        </div>

        <button onClick={onClose} style={{ ...css.btn, width: "100%", background: "#F3F4F6", color: "#374151" }}>Close</button>
      </div>
    </div>
  );
}

// ─── BULK: Add a secondary batch to every selected student at once ────────────
function BulkSecondaryBatchModal({ selectedIds, students, courseSubjects, secondaryBatchMap, onClose, onDone }) {
  const selected = students.filter(s => selectedIds.has(s.id));
  const allBatches = Object.keys(courseSubjects);
  const [batch, setBatch] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);

  const apply = async () => {
    if (!batch) { setErr("Pick a batch to add."); return; }
    setErr(""); setSaving(true);

    // Skip anyone who already primarily belongs to this batch, or already has
    // it as a secondary batch — inserting either would be redundant/invalid.
    const toAdd = selected.filter(s =>
      s.class_name !== batch && !(secondaryBatchMap?.[s.id] || []).includes(batch)
    );
    const alreadySet = selected.length - toAdd.length;

    if (!toAdd.length) {
      setSaving(false);
      setResult({ ok: true, added: 0, skipped: alreadySet, message: "Every selected student already has this batch (as primary or secondary) — nothing to add." });
      return;
    }

    const rows = toAdd.map(s => ({ student_id: s.id, batch }));
    const { error } = await supabase.from("student_secondary_batches").upsert(rows, { onConflict: "student_id,batch" });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setResult({ ok: true, added: toAdd.length, skipped: alreadySet });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 14, padding: 24, maxWidth: 480, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 600, marginBottom: 6 }}>🔗 Bulk Add Secondary Batch</div>
        <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 16 }}>
          Applying to <b>{selected.length}</b> selected student{selected.length === 1 ? "" : "s"}. Each will keep their existing batch
          and GCC No. unchanged, and additionally appear under the batch you pick below in Mark Entry, Report Cards, and Admit Cards.
        </div>

        {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>⚠️ {err}</div>}
        {result && (
          <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "8px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>
            ✅ {result.message || `Added secondary batch to ${result.added} student(s).`} {result.skipped > 0 && !result.message ? `${result.skipped} already had it and were skipped.` : ""}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase" }}>Secondary Batch</label>
          <select value={batch} onChange={e => setBatch(e.target.value)} style={css.input}>
            <option value="">— Select batch —</option>
            {allBatches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ ...css.btn, flex: 1, background: "#F3F4F6", color: "#374151" }}>{result ? "Close" : "Cancel"}</button>
          {!result && (
            <button onClick={apply} disabled={saving || !batch} style={{ ...css.btn, flex: 2, background: saving ? "#93C5FD" : "#7c3aed", color: "white" }}>
              {saving ? "⏳ Applying…" : `✅ Apply to ${selected.length}`}
            </button>
          )}
          {result && (
            <button onClick={onDone} style={{ ...css.btn, flex: 2, background: "#1a3c2e", color: "white" }}>Done</button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── SMART STUDENT ROSTER IMPORT (CSV/Excel → fuzzy match → add/merge) ────────
// Reuses findBestStudentMatch / normalizeNameValue / normalizeGccValue already
// defined near the top of this file for the marks-CSV importer, so the same
// matching quality (GCC → Admission No. → exact name → fuzzy name) applies here.
function StudentRosterImport({ courseSubjects, students, onStudentsChange, onDone }) {
  const isMobile = useMobile();
  const courses = Object.keys(courseSubjects);
  const [rawRows, setRawRows] = useState(null);   // parsed sheet rows (array of arrays)
  const [headers, setHeaders] = useState([]);
  const [colMap, setColMap] = useState({ name: -1, gcc: -1, admission: -1 });
  const [defaultTrack, setDefaultTrack] = useState("");
  const [defaultBatch, setDefaultBatch] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [rows, setRows] = useState([]);           // processed rows with match info
  const [saving, setSaving] = useState(false);
  const [saveSummary, setSaveSummary] = useState(null);
  const [manualOpenIdx, setManualOpenIdx] = useState(null);
  const [manualSearch, setManualSearch] = useState({});
  const fileInputRef = useRef(null);

  // ── Step 1: parse the uploaded file into headers + raw rows ─────────────
  const handleFile = async (file) => {
    setParseError(""); setParsing(true); setRows([]); setSaveSummary(null);
    try {
      await ensureLibs();
      const buf = await file.arrayBuffer();
      const wb = window.XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      if (!aoa.length) { setParseError("The file appears to be empty."); setParsing(false); return; }
      const hdrs = aoa[0].map(h => String(h ?? "").trim());
      const body = aoa.slice(1).filter(r => r.some(c => String(c ?? "").trim() !== ""));
      setHeaders(hdrs);
      setRawRows(body);

      // Best-effort auto column detection
      const findCol = (patterns) => hdrs.findIndex(h => patterns.some(p => h.toLowerCase().includes(p)));
      setColMap({
        name: findCol(["name", "student"]),
        gcc: findCol(["gcc"]),
        admission: findCol(["admission", "adm no", "adm.", "adm_no"]),
      });
    } catch (e) {
      setParseError("Could not read this file. Please upload a valid .csv or .xlsx file.");
    }
    setParsing(false);
  };

  // ── Step 2: process rows against existing students once columns + defaults are set ──
  const processRows = () => {
    if (!rawRows || colMap.name === -1) { setParseError("Please select which column holds the student name."); return; }
    setParseError("");
    const matchPool = students; // fuzzy-match against ALL existing students (track/batch reassigned per-row if picked)
    const processed = rawRows.map((r, idx) => {
      const rawName = String(r[colMap.name] ?? "").trim();
      const rawGcc = colMap.gcc !== -1 ? r[colMap.gcc] : "";
      const rawAdm = colMap.admission !== -1 ? r[colMap.admission] : "";
      if (!rawName) return { idx, rawName, rawGcc, rawAdm, status: "skip", reason: "Empty name" };

      const match = findBestStudentMatch({ rawName, rawGcc, rawAdm, matchPool });
      if (match.student) {
        return { idx, rawName, rawGcc, rawAdm, status: "existing", student: match.student, matchType: match.matchType, confidence: match.confidence };
      }
      return {
        idx, rawName, rawGcc, rawAdm, status: "new", suggestion: match.suggestion, confidence: match.confidence,
        track: defaultTrack, batch: defaultBatch,
      };
    });
    setRows(processed);
  };

  const updateRow = (idx, patch) => setRows(prev => prev.map(r => r.idx === idx ? { ...r, ...patch } : r));

  const markAsNew = (idx) => updateRow(idx, { status: "new", student: null, suggestion: null });
  const markManualMatch = (idx, student) => updateRow(idx, { status: "existing", student, matchType: "Manual", confidence: 1 });
  const markSkip = (idx) => updateRow(idx, { status: "skip", reason: "Manually skipped" });

  const newRowsCount = rows.filter(r => r.status === "new").length;
  const existingRowsCount = rows.filter(r => r.status === "existing").length;
  const skipRowsCount = rows.filter(r => r.status === "skip").length;

  // ── "Missing students" detector: existing students of the relevant batch(es)
  // who do NOT appear anywhere in the uploaded file (by GCC/admission/fuzzy name).
  // Scope defaults to whichever batch was explicitly picked for new students, but
  // that's optional — if a file contains only students who already exist (no "new"
  // rows), defaultBatch may never get clicked at all. So when it's unset, fall back
  // to auto-detecting the batch(es) actually represented among matched students in
  // this file, so the check still runs instead of silently doing nothing.
  const missingStudents = (() => {
    if (!rows.length) return [];
    const matchedIds = new Set(rows.filter(r => r.student).map(r => r.student.id));
    const matchedStudents = rows.filter(r => r.student).map(r => r.student);
    const scopeBatches = defaultBatch
      ? [defaultBatch.toUpperCase()]
      : [...new Set(matchedStudents.map(s => (s.class_name || "").toUpperCase()).filter(Boolean))];
    if (!scopeBatches.length) return [];
    return students.filter(s =>
      scopeBatches.includes((s.class_name || "").toUpperCase()) &&
      s.status !== "Dropout" &&
      !matchedIds.has(s.id)
    );
  })();
  // Human-readable label for the banner — one batch name, or "these batches" when
  // the file spans more than one (auto-detected) batch.
  const missingStudentsScopeLabel = (() => {
    if (defaultBatch) return defaultBatch;
    const scopeBatches = [...new Set(rows.filter(r => r.student).map(r => r.student.class_name).filter(Boolean))];
    return scopeBatches.length === 1 ? scopeBatches[0] : "the matched batch(es)";
  })();

  // GCC numbers about to be inserted that collide either with an existing
  // student already in the system, or with ANOTHER row also marked "new" in
  // this same batch (e.g. two rows both failed to auto-match, or a row was
  // manually switched to "new" after the initial match pass) — either case
  // violates the DB's unique constraint on students.gcc_no if sent together.
  const gccConflicts = (() => {
    const existingGcc = new Set(students.map(s => normalizeGccValue(s.gcc_no)).filter(Boolean));
    const newRows = rows.filter(r => r.status === "new" && r.rawGcc);
    const seenInBatch = new Map();
    const conflicts = [];
    newRows.forEach(r => {
      const key = normalizeGccValue(r.rawGcc);
      if (!key) return;
      if (existingGcc.has(key)) { conflicts.push(r); return; }
      if (seenInBatch.has(key)) { conflicts.push(r); conflicts.push(seenInBatch.get(key)); return; }
      seenInBatch.set(key, r);
    });
    return [...new Map(conflicts.map(r => [r.idx, r])).values()];
  })();

  const handleSaveNew = async () => {
    if (gccConflicts.length) return; // blocked — see warning banner in the UI
    setSaving(true);
    const toInsert = rows.filter(r => r.status === "new").map(r => {
      const batchVal = (r.batch || defaultBatch || "").trim();
      return {
        name: r.rawName.trim().toUpperCase(),
        gcc_no: r.rawGcc ? Number(normalizeGccValue(r.rawGcc)) || null : null,
        admission_no: r.rawAdm ? String(r.rawAdm).trim() : null,
        course: r.track || defaultTrack || "",
        class_name: batchVal.toUpperCase(),
        batch: batchVal,
      };
    }).filter(p => p.name);

    if (!toInsert.length) { setSaving(false); return; }

    const { data, error } = await supabase.from("students").insert(toInsert).select();
    if (error) {
      setSaveSummary({ ok: false, message: error.message });
      setSaving(false);
      return;
    }
    onStudentsChange([...students, ...(data || [])].sort((a, b) => (a.name || "").localeCompare(b.name || "")));
    setSaveSummary({ ok: true, added: data?.length || 0, skippedExisting: existingRowsCount, skipped: skipRowsCount });
    setSaving(false);
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={css.card}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>📥 Smart Roster Import</div>
        <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 16 }}>
          Upload a CSV or Excel roster. Existing students are matched automatically (GCC No. → Admission No. → exact name → fuzzy name);
          anything unmatched can be added as new, matched manually, or skipped. You can reuse this for every future exam's roster.
        </div>

        {!rawRows && (
          <div>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={parsing}
              style={{ ...css.btn, background: "#1a3c2e", color: "white", padding: "10px 22px" }}>
              {parsing ? "⏳ Reading file…" : "📂 Choose CSV / Excel File"}
            </button>
            {parseError && <div style={{ marginTop: 12, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5 }}>⚠️ {parseError}</div>}
          </div>
        )}

        {rawRows && !rows.length && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 8, textTransform: "uppercase" }}>Map Columns</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[["name", "Student Name *"], ["gcc", "GCC No."], ["admission", "Admission No."]].map(([key, label]) => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>{label}</label>
                  <select value={colMap[key]} onChange={e => setColMap(p => ({ ...p, [key]: Number(e.target.value) }))} style={css.input}>
                    <option value={-1}>— Not in file —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 8, textTransform: "uppercase" }}>Default Track / Batch for New Students</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {TRACKS.map(t => (
                <button key={t} onClick={() => setDefaultTrack(t)} style={{ ...css.btn, padding: "6px 14px", fontSize: 12, background: defaultTrack === t ? "#1a3c2e" : "#F3F4F6", color: defaultTrack === t ? "white" : "#374151" }}>{t}</button>
              ))}
            </div>
            {defaultTrack && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                {(TRACK_BATCHES[defaultTrack] || []).map(b => (
                  <button key={b} onClick={() => setDefaultBatch(b)} style={{ ...css.btn, padding: "5px 12px", fontSize: 12, background: defaultBatch === b ? "#7c3aed" : "#F5F3FF", color: defaultBatch === b ? "white" : "#5B21B6" }}>{b}</button>
                ))}
              </div>
            )}

            {parseError && <div style={{ marginBottom: 12, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5 }}>⚠️ {parseError}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setRawRows(null); setHeaders([]); }} style={{ ...css.btn, background: "#F3F4F6", color: "#374151" }}>← Back</button>
              <button onClick={processRows} style={{ ...css.btn, background: "#1a3c2e", color: "white", flex: 1 }}>🔎 Match {rawRows.length} Rows</button>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <Badge label={`${existingRowsCount} already exist`} color="#0F6E56" bg="#E1F5EE" />
              <Badge label={`${newRowsCount} new`} color="#047857" bg="#ECFDF5" />
              {skipRowsCount > 0 && <Badge label={`${skipRowsCount} skipped`} color="#92740C" bg="#FEF9E7" />}
            </div>

            <div style={{ maxHeight: 420, overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: 10, marginBottom: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead style={{ position: "sticky", top: 0 }}>
                  <tr style={{ background: "#1a3c2e" }}>
                    {["Row", "Name (from file)", "Match", "Action"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "white", fontWeight: 700, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.idx} style={{ borderBottom: "1px solid #F1F5F9", background: r.status === "skip" ? "#FAFAFA" : "white" }}>
                      <td style={{ padding: "7px 10px", color: "#9CA3AF" }}>{r.idx + 2}</td>
                      <td style={{ padding: "7px 10px", fontWeight: 600 }}>{r.rawName || <i style={{ color: "#DC2626" }}>{r.reason}</i>}</td>
                      <td style={{ padding: "7px 10px" }}>
                        {r.status === "existing" && (
                          <div>
                            <MatchBadge matchType={r.matchType} confidence={r.confidence} />
                            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{r.student?.name} · {r.student?.class_name}</div>
                          </div>
                        )}
                        {r.status === "new" && <MatchBadge matchType="New" />}
                        {r.status === "skip" && <span style={{ fontSize: 11, color: "#94A3B8" }}>Skipped</span>}
                        {r.status === "new" && r.suggestion && (
                          <div style={{ fontSize: 10.5, color: "#B8860B", marginTop: 2 }}>closest guess: {r.suggestion.name}</div>
                        )}
                      </td>
                      <td style={{ padding: "7px 10px" }}>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                          {r.status !== "new" && <button onClick={() => markAsNew(r.idx)} style={{ ...css.btn, padding: "3px 8px", fontSize: 10.5, background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0" }}>+ New</button>}
                          <button onClick={() => setManualOpenIdx(manualOpenIdx === r.idx ? null : r.idx)} style={{ ...css.btn, padding: "3px 8px", fontSize: 10.5, background: "#EEF2FF", color: "#4338CA", border: "1px solid #C7D2FE" }}>🔍 Pick manually</button>
                          {r.status !== "skip" && <button onClick={() => markSkip(r.idx)} style={{ ...css.btn, padding: "3px 8px", fontSize: 10.5, background: "#F3F4F6", color: "#6B7280" }}>Skip</button>}
                        </div>
                        {manualOpenIdx === r.idx && (
                          <div style={{ marginTop: 6 }}>
                            <input placeholder="Search existing students…" value={manualSearch[r.idx] || ""} onChange={e => setManualSearch(p => ({ ...p, [r.idx]: e.target.value }))} style={{ ...css.input, fontSize: 11, padding: "4px 8px" }} />
                            <div style={{ maxHeight: 140, overflowY: "auto", marginTop: 4, border: "1px solid #E5E7EB", borderRadius: 6 }}>
                              {students
                                .filter(s => {
                                  const q = (manualSearch[r.idx] || "").toLowerCase();
                                  return !q || (s.name || "").toLowerCase().includes(q) || String(s.gcc_no ?? "").includes(q);
                                })
                                .slice(0, 25)
                                .map(s => (
                                  <div key={s.id} onClick={() => { markManualMatch(r.idx, s); setManualOpenIdx(null); }}
                                    style={{ padding: "4px 8px", fontSize: 11, cursor: "pointer", borderBottom: "1px solid #F1F5F9" }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                                    onMouseLeave={e => e.currentTarget.style.background = "white"}>
                                    {s.name} — GCC {s.gcc_no} ({s.class_name})
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {missingStudents.length > 0 && (
              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: 14, marginBottom: 16 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#92400E", marginBottom: 6 }}>⚠️ {missingStudents.length} student(s) in {missingStudentsScopeLabel} not found in this file:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {missingStudents.map(s => (
                    <span key={s.id} style={{ fontSize: 11, background: "white", border: "1px solid #FDE68A", borderRadius: 999, padding: "2px 9px", color: "#92400E" }}>{s.name}</span>
                  ))}
                </div>
              </div>
            )}

            {gccConflicts.length > 0 && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 12.5, color: "#991B1B" }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠️ {gccConflicts.length} row(s) marked "New" have a GCC No. that already exists or is duplicated within this file:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                  {gccConflicts.map(r => (
                    <span key={r.idx} style={{ fontSize: 11, background: "white", border: "1px solid #FECACA", borderRadius: 999, padding: "2px 9px" }}>{r.rawName} (GCC {r.rawGcc})</span>
                  ))}
                </div>
                Adding is blocked until these are resolved — use <b>🔍 Pick manually</b> to match them to the existing student, mark one as Skip, or correct the GCC No. and re-upload.
              </div>
            )}

            {saveSummary && (
              <div style={{ background: saveSummary.ok ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${saveSummary.ok ? "#BBF7D0" : "#FECACA"}`, color: saveSummary.ok ? "#166534" : "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
                {saveSummary.ok
                  ? `✅ Added ${saveSummary.added} new student(s). ${saveSummary.skippedExisting} already existed, ${saveSummary.skipped} skipped.`
                  : `⚠️ ${saveSummary.message}`}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => { setRawRows(null); setHeaders([]); setRows([]); setSaveSummary(null); }} style={{ ...css.btn, background: "#F3F4F6", color: "#374151" }}>← Start Over</button>
              <button onClick={handleSaveNew} disabled={saving || newRowsCount === 0 || gccConflicts.length > 0} style={{ ...css.btn, background: saving ? "#93C5FD" : gccConflicts.length ? "#D1D5DB" : "#1a3c2e", color: "white", flex: 1 }}>
                {saving ? "⏳ Saving…" : gccConflicts.length ? "⚠️ Resolve GCC conflicts above first" : `✅ Add ${newRowsCount} New Student(s)`}
              </button>
              <button onClick={onDone} style={{ ...css.btn, background: "#F3F4F6", color: "#374151" }}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SECONDARY BATCH CSV/EXCEL IMPORT ──────────────────────────────────────────
// Upload a list of students (by GCC No. and/or Name — e.g. a list of students
// who are also appearing for the Combined Navodaya exam) and assign all of
// them to one secondary batch in one go, reusing the same fuzzy-match logic
// as the other importers. Only ever writes to student_secondary_batches —
// never touches the student's row, GCC, or primary batch.
function SecondaryBatchCSVImport({ courseSubjects, students, onChanged, onDone }) {
  const isMobile = useMobile();
  const allBatches = Object.keys(courseSubjects);
  const [rawRows, setRawRows] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [colMap, setColMap] = useState({ name: -1, gcc: -1, admission: -1 });
  const [batch, setBatch] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveSummary, setSaveSummary] = useState(null);
  const [manualOpenIdx, setManualOpenIdx] = useState(null);
  const [manualSearch, setManualSearch] = useState({});
  const fileInputRef = useRef(null);

  const handleFile = async (file) => {
    setParseError(""); setParsing(true); setRows([]); setSaveSummary(null);
    try {
      await ensureLibs();
      const buf = await file.arrayBuffer();
      const wb = window.XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      if (!aoa.length) { setParseError("The file appears to be empty."); setParsing(false); return; }
      const hdrs = aoa[0].map(h => String(h ?? "").trim());
      const body = aoa.slice(1).filter(r => r.some(c => String(c ?? "").trim() !== ""));
      setHeaders(hdrs);
      setRawRows(body);

      const findCol = (patterns) => hdrs.findIndex(h => patterns.some(p => h.toLowerCase().includes(p)));
      setColMap({
        name: findCol(["name of student", "name", "student"]),
        gcc: findCol(["gcc"]),
        admission: findCol(["admission", "adm no", "adm."]),
      });
    } catch (e) {
      setParseError("Could not read this file. Please upload a valid .csv or .xlsx file.");
    }
    setParsing(false);
  };

  const processRows = () => {
    if (!rawRows) { setParseError("File has no rows to match."); return; }
    if (colMap.name === -1 && colMap.gcc === -1) { setParseError("Please select at least a Name or GCC No. column."); return; }
    setParseError("");
    const matchPool = students;
    const processed = rawRows.map((r, idx) => {
      const rawName = colMap.name !== -1 ? String(r[colMap.name] ?? "").trim() : "";
      const rawGcc = colMap.gcc !== -1 ? r[colMap.gcc] : "";
      const rawAdm = colMap.admission !== -1 ? r[colMap.admission] : "";
      if (!rawName && !rawGcc) return { idx, rawName, rawGcc, rawAdm, status: "skip", reason: "Empty row" };

      const match = findBestStudentMatch({ rawName, rawGcc, rawAdm, matchPool });
      if (match.student) {
        return { idx, rawName, rawGcc, rawAdm, status: "matched", student: match.student, matchType: match.matchType, confidence: match.confidence };
      }
      return { idx, rawName, rawGcc, rawAdm, status: "unmatched", suggestion: match.suggestion, confidence: match.confidence };
    });
    setRows(processed);
  };

  const updateRow = (idx, patch) => setRows(prev => prev.map(r => r.idx === idx ? { ...r, ...patch } : r));
  const markManualMatch = (idx, student) => updateRow(idx, { status: "matched", student, matchType: "Manual", confidence: 1 });
  const markSkip = (idx) => updateRow(idx, { status: "skip", reason: "Manually skipped" });

  const matchedCount = rows.filter(r => r.status === "matched").length;
  const unmatchedCount = rows.filter(r => r.status === "unmatched").length;
  const skipCount = rows.filter(r => r.status === "skip").length;

  // Students who already have this batch (as primary or an existing
  // secondary) — shown so it's clear they'll just be skipped, not duplicated.
  const alreadyHaveBatch = rows.filter(r => r.status === "matched" && r.student.class_name === batch).length;

  const handleImportAll = async () => {
    if (!batch) { setParseError("Pick which secondary batch to assign."); return; }
    setSaving(true);
    const matched = rows.filter(r => r.status === "matched" && r.student && r.student.class_name !== batch);
    if (!matched.length) {
      setSaving(false);
      setSaveSummary({ ok: true, added: 0, message: "No students to add — either none matched, or they already belong to this batch." });
      return;
    }
    const dbRows = matched.map(r => ({ student_id: r.student.id, batch }));
    const { error } = await supabase.from("student_secondary_batches").upsert(dbRows, { onConflict: "student_id,batch" });
    setSaving(false);
    if (error) { setSaveSummary({ ok: false, message: error.message }); return; }
    onChanged?.();
    setSaveSummary({ ok: true, added: matched.length, skipped: rows.length - matched.length });
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={css.card}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>🔗📥 Import Secondary Batch</div>
        <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 16 }}>
          Upload a list of existing students (by GCC No. and/or Name) and assign all of them to one secondary batch at once — e.g. a
          list of Sainik-batch students who are also appearing for the Combined Navodaya exam. This never changes their primary batch,
          GCC No., or creates a duplicate student — it only adds the extra batch tag.
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>Secondary Batch to Assign *</label>
          <select value={batch} onChange={e => setBatch(e.target.value)} style={css.input}>
            <option value="">— Select batch —</option>
            {allBatches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {!rawRows && (
          <div>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={parsing}
              style={{ ...css.btn, background: "#1a3c2e", color: "white", padding: "10px 22px" }}>
              {parsing ? "⏳ Reading file…" : "📂 Choose CSV / Excel File"}
            </button>
            {parseError && <div style={{ marginTop: 12, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5 }}>⚠️ {parseError}</div>}
          </div>
        )}

        {rawRows && !rows.length && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 8, textTransform: "uppercase" }}>Map Columns</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[["name", "Student Name"], ["gcc", "GCC No."], ["admission", "Admission No."]].map(([key, label]) => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>{label}</label>
                  <select value={colMap[key]} onChange={e => setColMap(p => ({ ...p, [key]: Number(e.target.value) }))} style={css.input}>
                    <option value={-1}>— Not in file —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {parseError && <div style={{ marginBottom: 12, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5 }}>⚠️ {parseError}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setRawRows(null); setHeaders([]); }} style={{ ...css.btn, background: "#F3F4F6", color: "#374151" }}>← Back</button>
              <button onClick={processRows} style={{ ...css.btn, background: "#1a3c2e", color: "white", flex: 1 }}>🔎 Match {rawRows.length} Rows</button>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <Badge label={`${matchedCount} matched`} color="#0F6E56" bg="#E1F5EE" />
              {unmatchedCount > 0 && <Badge label={`${unmatchedCount} unmatched`} color="#A32D2D" bg="#FCEBEB" />}
              {skipCount > 0 && <Badge label={`${skipCount} skipped`} color="#92740C" bg="#FEF9E7" />}
              {alreadyHaveBatch > 0 && <Badge label={`${alreadyHaveBatch} already in this batch`} color="#7c3aed" bg="#F5F3FF" />}
            </div>

            <div style={{ maxHeight: 420, overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: 10, marginBottom: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead style={{ position: "sticky", top: 0 }}>
                  <tr style={{ background: "#1a3c2e" }}>
                    {["Row", "Name (from file)", "Match", "Action"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "white", fontWeight: 700, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.idx} style={{ borderBottom: "1px solid #F1F5F9", background: r.status === "skip" ? "#FAFAFA" : "white" }}>
                      <td style={{ padding: "7px 10px", color: "#9CA3AF" }}>{r.idx + 2}</td>
                      <td style={{ padding: "7px 10px", fontWeight: 600 }}>{r.rawName || r.rawGcc || <i style={{ color: "#DC2626" }}>{r.reason}</i>}</td>
                      <td style={{ padding: "7px 10px" }}>
                        {r.status === "matched" && (
                          <div>
                            <MatchBadge matchType={r.matchType} confidence={r.confidence} />
                            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                              {r.student?.name} · {r.student?.class_name}
                              {r.student?.class_name === batch && <span style={{ color: "#7c3aed", fontWeight: 700 }}> (already this batch)</span>}
                            </div>
                          </div>
                        )}
                        {r.status === "unmatched" && <span style={{ fontSize: 11, color: "#A32D2D", fontWeight: 700 }}>No match found</span>}
                        {r.status === "skip" && <span style={{ fontSize: 11, color: "#94A3B8" }}>{r.reason || "Skipped"}</span>}
                        {r.status === "unmatched" && r.suggestion && (
                          <div style={{ fontSize: 10.5, color: "#B8860B", marginTop: 2 }}>closest guess: {r.suggestion.name}</div>
                        )}
                      </td>
                      <td style={{ padding: "7px 10px" }}>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                          <button onClick={() => setManualOpenIdx(manualOpenIdx === r.idx ? null : r.idx)} style={{ ...css.btn, padding: "3px 8px", fontSize: 10.5, background: "#EEF2FF", color: "#4338CA", border: "1px solid #C7D2FE" }}>🔍 Pick manually</button>
                          {r.status !== "skip" && <button onClick={() => markSkip(r.idx)} style={{ ...css.btn, padding: "3px 8px", fontSize: 10.5, background: "#F3F4F6", color: "#6B7280" }}>Skip</button>}
                        </div>
                        {manualOpenIdx === r.idx && (
                          <div style={{ marginTop: 6 }}>
                            <input placeholder="Search existing students…" value={manualSearch[r.idx] || ""} onChange={e => setManualSearch(p => ({ ...p, [r.idx]: e.target.value }))} style={{ ...css.input, fontSize: 11, padding: "4px 8px" }} />
                            <div style={{ maxHeight: 140, overflowY: "auto", marginTop: 4, border: "1px solid #E5E7EB", borderRadius: 6 }}>
                              {students
                                .filter(s => {
                                  const q = (manualSearch[r.idx] || "").toLowerCase();
                                  return !q || (s.name || "").toLowerCase().includes(q) || String(s.gcc_no ?? "").includes(q);
                                })
                                .slice(0, 25)
                                .map(s => (
                                  <div key={s.id} onClick={() => { markManualMatch(r.idx, s); setManualOpenIdx(null); }}
                                    style={{ padding: "4px 8px", fontSize: 11, cursor: "pointer", borderBottom: "1px solid #F1F5F9" }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                                    onMouseLeave={e => e.currentTarget.style.background = "white"}>
                                    {s.name} — GCC {s.gcc_no} ({s.class_name})
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {parseError && <div style={{ marginBottom: 12, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5 }}>⚠️ {parseError}</div>}

            {saveSummary && (
              <div style={{ background: saveSummary.ok ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${saveSummary.ok ? "#BBF7D0" : "#FECACA"}`, color: saveSummary.ok ? "#166534" : "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 14 }}>
                {saveSummary.ok
                  ? (saveSummary.message || `✅ Added secondary batch "${batch}" to ${saveSummary.added} student(s). ${saveSummary.skipped || 0} skipped/unmatched.`)
                  : `⚠️ ${saveSummary.message}`}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => { setRawRows(null); setHeaders([]); setRows([]); setSaveSummary(null); }} style={{ ...css.btn, background: "#F3F4F6", color: "#374151" }}>← Start Over</button>
              <button onClick={handleImportAll} disabled={saving || !batch || matchedCount === 0} style={{ ...css.btn, background: saving ? "#93C5FD" : "#7c3aed", color: "white", flex: 1 }}>
                {saving ? "⏳ Importing…" : `✅ Assign Secondary Batch to ${matchedCount - alreadyHaveBatch} Student(s)`}
              </button>
              <button onClick={onDone} style={{ ...css.btn, background: "#F3F4F6", color: "#374151" }}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


// Built for result sheets that already carry Sl.No / GCC No. / Name / per-subject
// marks / Score / Rank (e.g. exported "RESULT_<SECTION>_<BATCH>.xls" files) — the
// same shape as a normal marks import, but this ALSO seeds the student roster
// (so future exams have these students ready) and tags a "section" label
// (e.g. ENG / MAN medium-of-instruction group) purely for display, stored in the
// `batch` column as a suffix. `batch` is written but never read for course-key
// matching anywhere else in this file — only `class_name` is — so this is safe.
function ResultSheetImport({ courseSubjects, students, examTypes, onStudentsChange, onDone }) {
  const isMobile = useMobile();
  const courses = Object.keys(courseSubjects);
  const [rawRows, setRawRows] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [colMap, setColMap] = useState({ name: -1, gcc: -1, admission: -1 });
  const [subjectColMap, setSubjectColMap] = useState([]); // [{sub, col, matchType, confidence}]
  const [track, setTrack] = useState("Combined Course");
  const [batch, setBatch] = useState("Combined Navodaya Course (Sainik Appearing Group)");
  const [section, setSection] = useState("");   // e.g. "ENG" / "MAN" — display tag only
  const [examTypeId, setExamTypeId] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState(new Date().toISOString().split("T")[0]);
  const [examTime, setExamTime] = useState("");     // optional — needed for Admit Cards
  const [examShift, setExamShift] = useState("");   // optional — e.g. "Morning" / "Afternoon"
  const [examRoom, setExamRoom] = useState("");     // optional — room/hall
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveSummary, setSaveSummary] = useState(null);
  const [manualOpenIdx, setManualOpenIdx] = useState(null);
  const [manualSearch, setManualSearch] = useState({});
  const fileInputRef = useRef(null);

  const subjects = courseSubjects[batch] || [];

  const handleFile = async (file) => {
    setParseError(""); setParsing(true); setRows([]); setSaveSummary(null);
    try {
      await ensureLibs();
      const buf = await file.arrayBuffer();
      const wb = window.XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const aoa = window.XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
      if (!aoa.length) { setParseError("The file appears to be empty."); setParsing(false); return; }
      const hdrs = aoa[0].map(h => String(h ?? "").trim());
      const body = aoa.slice(1).filter(r => r.some(c => String(c ?? "").trim() !== ""));
      setHeaders(hdrs);
      setRawRows(body);

      const findCol = (patterns) => hdrs.findIndex(h => patterns.some(p => h.toLowerCase().includes(p)));
      const nameCol = findCol(["name of student", "name", "student"]);
      const gccCol = findCol(["gcc"]);
      const admCol = findCol(["admission", "adm no", "adm."]);
      setColMap({ name: nameCol, gcc: gccCol, admission: admCol });

      // Auto-detect which columns hold marks for this batch's subjects (reuses
      // the same column-matching helper as the marks CSV importer).
      const excluded = new Set([nameCol, gccCol, admCol, findCol(["sl. no", "sl no"]), findCol(["score"]), findCol(["rank"])].filter(i => i !== -1));
      setSubjectColMap(findBestColumnMatches(subjects, hdrs, excluded));

      // Best-effort section guess from the filename, e.g. RESULT__ENG_COMBINED.xls
      const guess = file.name.toUpperCase().match(/\b(ENG|MAN|HIN|MEI)\b/);
      if (guess) setSection(guess[1]);
    } catch (e) {
      setParseError("Could not read this file. Please upload a valid .csv or .xlsx file.");
    }
    setParsing(false);
  };

  const processRows = () => {
    if (!rawRows || colMap.name === -1) { setParseError("Please select which column holds the student name."); return; }
    setParseError("");
    const matchPool = students;
    const seenGcc = new Map();   // normalized GCC -> row idx already claimed within THIS file
    const seenName = new Map();  // normalized name -> row idx already claimed within THIS file
    const processed = rawRows.map((r, idx) => {
      const rawName = String(r[colMap.name] ?? "").trim();
      const rawGcc = colMap.gcc !== -1 ? r[colMap.gcc] : "";
      const rawAdm = colMap.admission !== -1 ? r[colMap.admission] : "";
      const subMarks = extractSubMarksFromRow(r, subjectColMap);
      if (!rawName) return { idx, rawName, rawGcc, rawAdm, subMarks, status: "skip", reason: "Empty name" };

      // In-file duplicate guard: same GCC or same normalized name appearing twice
      // in this upload would otherwise create two separate "new" student rows.
      const gccKey = rawGcc ? normalizeGccValue(rawGcc) : "";
      const nameKey = normalizeNameValue(rawName);
      if (gccKey && seenGcc.has(gccKey)) {
        return { idx, rawName, rawGcc, rawAdm, subMarks, status: "skip", reason: `Duplicate GCC ${rawGcc} (already seen at row ${seenGcc.get(gccKey) + 2})` };
      }
      if (!gccKey && seenName.has(nameKey)) {
        return { idx, rawName, rawGcc, rawAdm, subMarks, status: "skip", reason: `Duplicate name (already seen at row ${seenName.get(nameKey) + 2})` };
      }
      if (gccKey) seenGcc.set(gccKey, idx); else seenName.set(nameKey, idx);

      const match = findBestStudentMatch({ rawName, rawGcc, rawAdm, matchPool });
      if (match.student) {
        return { idx, rawName, rawGcc, rawAdm, subMarks, status: "existing", student: match.student, matchType: match.matchType, confidence: match.confidence };
      }
      return { idx, rawName, rawGcc, rawAdm, subMarks, status: "new", suggestion: match.suggestion, confidence: match.confidence };
    });
    setRows(processed);
  };

  const updateRow = (idx, patch) => setRows(prev => prev.map(r => r.idx === idx ? { ...r, ...patch } : r));
  const markAsNew = (idx) => updateRow(idx, { status: "new", student: null, suggestion: null });
  const markManualMatch = (idx, student) => updateRow(idx, { status: "existing", student, matchType: "Manual", confidence: 1 });
  const markSkip = (idx) => updateRow(idx, { status: "skip", reason: "Manually skipped" });

  const newCount = rows.filter(r => r.status === "new").length;
  const existingCount = rows.filter(r => r.status === "existing").length;
  const skipCount = rows.filter(r => r.status === "skip").length;

  // GCC numbers that are about to be inserted as new students but collide with
  // (a) a GCC already in the system, e.g. the local `students` list is stale, or
  // (b) another row ALSO marked "new" in this same batch — this second case is
  // the one that actually violates the DB's unique constraint on bulk insert:
  // the initial in-file dedup in processRows() only runs once at match time, so
  // if a row is later manually switched to "new" (via markAsNew / "Pick manually"
  // reverted), or two rows both fail to auto-match and both get left as "new"
  // with the same GCC, nothing re-checks them against each other before the
  // insert — this closes that gap.
  const gccConflicts = (() => {
    const existingGcc = new Set(students.map(s => normalizeGccValue(s.gcc_no)).filter(Boolean));
    const newRows = rows.filter(r => r.status === "new" && r.rawGcc);
    const seenInBatch = new Map(); // gcc key -> first row idx claiming it
    const conflicts = [];
    newRows.forEach(r => {
      const key = normalizeGccValue(r.rawGcc);
      if (!key) return;
      if (existingGcc.has(key)) { conflicts.push(r); return; }
      if (seenInBatch.has(key)) { conflicts.push(r); conflicts.push(seenInBatch.get(key)); return; }
      seenInBatch.set(key, r);
    });
    // de-duplicate (a row can only be flagged once, even though the loop above
    // can push the same "first claimant" row multiple times if 3+ rows collide)
    return [...new Map(conflicts.map(r => [r.idx, r])).values()];
  })();

  // ── "Missing students" detector: existing (non-Dropout) students of the
  // chosen batch who do NOT appear anywhere in this result sheet — i.e. someone
  // on the roster whose result wasn't in the file at all (absent-from-import,
  // not the same as MarkEntry's absent-with-zero-marks). `batch` here is
  // always an explicit required field (unlike the generic roster importer), so
  // this check always has a scope to run against once rows are matched.
  const missingStudents = (() => {
    if (!rows.length || !batch) return [];
    const matchedIds = new Set(rows.filter(r => r.student).map(r => r.student.id));
    return students.filter(s =>
      (s.class_name || "").toUpperCase() === batch.trim().toUpperCase() &&
      s.status !== "Dropout" &&
      !matchedIds.has(s.id)
    );
  })();

  const handleImportAll = async () => {
    if (gccConflicts.length) return; // blocked — see warning banner in the UI
    setSaving(true);
    const batchVal = batch.trim();
    const sectionSuffix = section.trim() ? ` — ${section.trim().toUpperCase()}` : "";

    // 1) Insert new students (roster), tagging batch with the section suffix.
    // Each outgoing row carries a client-side `_rowIdx` so the inserted rows
    // can be matched back to their source row by GCC/name instead of by
    // array position — Postgres/PostgREST does NOT guarantee that a bulk
    // insert().select() returns rows in the same order they were sent.
    const newRowsToInsert = rows.filter(r => r.status === "new" && r.rawName);
    const toInsert = newRowsToInsert.map(r => ({
      name: r.rawName.trim().toUpperCase(),
      gcc_no: r.rawGcc ? Number(normalizeGccValue(r.rawGcc)) || null : null,
      admission_no: r.rawAdm ? String(r.rawAdm).trim() : null,
      course: track,
      class_name: batchVal.toUpperCase(),
      batch: batchVal + sectionSuffix,
    }));

    let insertedStudents = [];
    if (toInsert.length) {
      const { data, error } = await supabase.from("students").insert(toInsert).select();
      if (error) {
        setSaveSummary({ ok: false, message: `Import stopped before any changes were made: ${error.message}` });
        setSaving(false);
        return;
      }
      insertedStudents = data || [];
    }

    // Map each inserted DB row back to its source file row by GCC (or, lacking
    // a GCC, by exact normalized name) — never by position.
    const idByRowIdx = {};
    rows.forEach(r => {
      if (r.status === "existing" && r.student) idByRowIdx[r.idx] = r.student.id;
    });
    newRowsToInsert.forEach(r => {
      const gccKey = r.rawGcc ? normalizeGccValue(r.rawGcc) : "";
      const nameKey = normalizeNameValue(r.rawName);
      const found = insertedStudents.find(s =>
        gccKey ? normalizeGccValue(s.gcc_no) === gccKey : normalizeNameValue(s.name) === nameKey
      );
      if (found) idByRowIdx[r.idx] = found.id;
    });

    // Existing students matched from this file are NOT touched on their
    // primary batch/class_name at all — that was the bug here previously:
    // appending the section suffix onto whatever their current `batch` value
    // already was (e.g. turning "ACHIEVER" into "ACHIEVER — ENG") silently
    // mutated their real identity and caused class_name/batch to drift apart,
    // which is what produced confusing dual-appearance behavior. Instead,
    // matched existing students are recorded as properly belonging to THIS
    // (Combined Navodaya) batch via student_secondary_batches — the same
    // mechanism the 🔗 Secondary Batch feature uses — leaving their real
    // Sainik/Foundation/Navodaya batch completely untouched.
    const existingToLink = rows.filter(r => r.status === "existing" && r.student && r.student.class_name !== batchVal);
    const secondaryBatchValue = batchVal + sectionSuffix;
    const linkErrors = [];
    if (existingToLink.length) {
      const linkRows = existingToLink.map(r => ({ student_id: r.student.id, batch: secondaryBatchValue }));
      const { error } = await supabase.from("student_secondary_batches").upsert(linkRows, { onConflict: "student_id,batch" });
      if (error) linkErrors.push(`student_secondary_batches: ${error.message}`);
    }

    // 2) Ensure exam_schedule rows exist for this batch + exam type + date
    //    (one per subject), so marks have somewhere to attach to.
    const { data: existingSched } = await supabase
      .from("exam_schedule")
      .select("id, subject")
      .eq("exam_type_id", examTypeId)
      .eq("course", batchVal);
    const subjectToExamId = {};
    (existingSched || []).forEach(s => { subjectToExamId[s.subject] = s.id; });

    const missingSubjects = subjects.filter(s => !subjectToExamId[s]);
    if (missingSubjects.length) {
      const newSchedRows = missingSubjects.map(sub => ({
        exam_type_id: examTypeId, course: batchVal, subject: sub,
        exam_date: examDate, total_marks: getSubjectMax(batchVal, sub) || 20,
        time: examTime || null, shift: examShift || null, room: examRoom || null,
      }));
      const { data: createdSched, error: schedErr } = await supabase.from("exam_schedule").insert(newSchedRows).select();
      if (schedErr) {
        setSaveSummary({
          ok: false,
          message: `Students were added (${insertedStudents.length}) but the exam schedule could not be created: ${schedErr.message}. Marks were NOT imported — re-run the import once schedule creation succeeds; already-added students won't be duplicated.`,
        });
        setSaving(false);
        // Existing matched students were never mutated (see note above), so
        // the local list just needs the newly-inserted students merged in.
        onStudentsChange([...students, ...insertedStudents].sort((a, b) => (a.name || "").localeCompare(b.name || "")));
        return;
      }
      (createdSched || []).forEach(s => { subjectToExamId[s.subject] = s.id; });
    }

    // 3) Upsert exam_marks for every matched/new student × subject with marks in the file
    const markRows = [];
    rows.forEach(r => {
      if (r.status === "skip") return;
      const sid = idByRowIdx[r.idx];
      if (!sid) return;
      subjects.forEach(sub => {
        const examId = subjectToExamId[sub];
        if (!examId) return;
        const m = r.subMarks[sub];
        if (m === undefined) return;
        markRows.push({
          student_id: sid, exam_id: examId, exam_type_id: examTypeId, exam_date: examDate,
          subject: sub, marks_obtained: m, marks: m, max_marks: getSubjectMax(batchVal, sub),
          total_marks: getSubjectMax(batchVal, sub), class_name: batchVal.toUpperCase(),
        });
      });
    });

    const writeErrors = [];
    for (let i = 0; i < markRows.length; i += 100) {
      const { error } = await supabase.from("exam_marks").upsert(markRows.slice(i, i + 100), { onConflict: "student_id,exam_id" });
      if (error) writeErrors.push(error.message || String(error));
    }

    // Refresh local student list — existing matched students are untouched
    // (their secondary-batch link lives in student_secondary_batches, not on
    // their row), so this just merges in the newly-inserted students.
    onStudentsChange([...students, ...insertedStudents].sort((a, b) => (a.name || "").localeCompare(b.name || "")));

    setSaving(false);
    const allErrors = [...linkErrors, ...writeErrors];
    setSaveSummary({
      ok: allErrors.length === 0,
      message: allErrors.length
        ? `${insertedStudents.length} student(s) added and ${markRows.length} mark entries written, but ${allErrors.length} operation(s) failed: ${allErrors[0]}${allErrors.length > 1 ? ` (+${allErrors.length - 1} more)` : ""}`
        : `✅ Added ${insertedStudents.length} new student(s), linked ${existingToLink.length} existing student(s) to this batch as a secondary batch, wrote ${markRows.length} mark entries. ${skipCount} row(s) skipped.`,
      added: insertedStudents.length,
      matched: existingCount,
      skipped: skipCount,
      marksWritten: markRows.length,
    });
  };

  return (
    <div style={{ maxWidth: 940 }}>
      <div style={css.card}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>🧾 Import Result Sheet (Roster + Marks + Section)</div>
        <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 16 }}>
          Upload a result sheet (Sl. No. / GCC No. / Name / subject marks / Score / Rank). This adds any new students to the permanent
          roster, tags them with a section label (e.g. ENG / MAN) for future filtering, and imports these marks as a real exam — all in
          one step. The roster is then reused automatically for every future exam of this batch.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>Track</label>
            <select value={track} onChange={e => setTrack(e.target.value)} style={css.input}>
              {TRACKS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>Batch</label>
            <select value={batch} onChange={e => setBatch(e.target.value)} style={css.input}>
              {courses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>Section Tag (optional)</label>
            <input value={section} onChange={e => setSection(e.target.value)} placeholder="e.g. ENG, MAN" style={css.input} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>Exam Type</label>
            <select value={examTypeId} onChange={e => setExamTypeId(e.target.value)} style={css.input}>
              {examTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>Exam Date</label>
            <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} style={css.input} />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>
            Time / Shift / Room <span style={{ fontWeight: 400, textTransform: "none", color: "#9CA3AF" }}>(optional — only needed if you also want Admit Cards for this sitting)</span>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10 }}>
            <input value={examTime} onChange={e => setExamTime(e.target.value)} placeholder="e.g. 09:00 AM" style={css.input} />
            <input value={examShift} onChange={e => setExamShift(e.target.value)} placeholder="e.g. Morning" style={css.input} />
            <input value={examRoom} onChange={e => setExamRoom(e.target.value)} placeholder="e.g. Hall 2" style={css.input} />
          </div>
        </div>

        {!rawRows && (
          <div>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={parsing}
              style={{ ...css.btn, background: "#1a3c2e", color: "white", padding: "10px 22px" }}>
              {parsing ? "⏳ Reading file…" : "📂 Choose Result Sheet File"}
            </button>
            {parseError && <div style={{ marginTop: 12, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5 }}>⚠️ {parseError}</div>}
          </div>
        )}

        {rawRows && !rows.length && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 8, textTransform: "uppercase" }}>Map Identity Columns</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[["name", "Student Name *"], ["gcc", "GCC No."], ["admission", "Admission No."]].map(([key, label]) => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>{label}</label>
                  <select value={colMap[key]} onChange={e => setColMap(p => ({ ...p, [key]: Number(e.target.value) }))} style={css.input}>
                    <option value={-1}>— Not in file —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 8, textTransform: "uppercase" }}>Subject Columns for {batch}</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 8, marginBottom: 16 }}>
              {subjects.map(sub => {
                const entry = subjectColMap.find(m => m.sub === sub) || { col: -1, matchType: "none", confidence: 0 };
                return (
                  <div key={sub} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, width: 140, flexShrink: 0 }}>{sub}</div>
                    <select value={entry.col} onChange={e => {
                      const col = Number(e.target.value);
                      setSubjectColMap(prev => {
                        const next = prev.filter(m => m.sub !== sub);
                        next.push({ sub, col, matchType: "Manual", confidence: 1 });
                        return next;
                      });
                    }} style={{ ...css.input, flex: 1 }}>
                      <option value={-1}>— Not in file —</option>
                      {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                    </select>
                    <ColumnMatchBadge matchType={entry.matchType} confidence={entry.confidence} />
                  </div>
                );
              })}
            </div>

            {parseError && <div style={{ marginBottom: 12, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5 }}>⚠️ {parseError}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setRawRows(null); setHeaders([]); }} style={{ ...css.btn, background: "#F3F4F6", color: "#374151" }}>← Back</button>
              <button onClick={processRows} style={{ ...css.btn, background: "#1a3c2e", color: "white", flex: 1 }}>🔎 Match {rawRows.length} Rows</button>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <Badge label={`${existingCount} already on roster`} color="#0F6E56" bg="#E1F5EE" />
              <Badge label={`${newCount} new students`} color="#047857" bg="#ECFDF5" />
              {skipCount > 0 && <Badge label={`${skipCount} skipped`} color="#92740C" bg="#FEF9E7" />}
              {section.trim() && <Badge label={`Section: ${section.trim().toUpperCase()}`} color="#4338CA" bg="#EEF2FF" />}
            </div>

            <div style={{ maxHeight: 420, overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: 10, marginBottom: 16 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead style={{ position: "sticky", top: 0 }}>
                  <tr style={{ background: "#1a3c2e" }}>
                    {["Row", "Name (from file)", "Match", "Marks Found", "Action"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "white", fontWeight: 700, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.idx} style={{ borderBottom: "1px solid #F1F5F9", background: r.status === "skip" ? "#FAFAFA" : "white" }}>
                      <td style={{ padding: "7px 10px", color: "#9CA3AF" }}>{r.idx + 2}</td>
                      <td style={{ padding: "7px 10px", fontWeight: 600 }}>{r.rawName || <i style={{ color: "#DC2626" }}>{r.reason}</i>}</td>
                      <td style={{ padding: "7px 10px" }}>
                        {r.status === "existing" && (
                          <div>
                            <MatchBadge matchType={r.matchType} confidence={r.confidence} />
                            <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>{r.student?.name} · {r.student?.class_name}</div>
                          </div>
                        )}
                        {r.status === "new" && <MatchBadge matchType="New" />}
                        {r.status === "skip" && <span style={{ fontSize: 11, color: "#94A3B8" }}>{r.reason || "Skipped"}</span>}
                        {r.status === "new" && r.suggestion && (
                          <div style={{ fontSize: 10.5, color: "#B8860B", marginTop: 2 }}>closest guess: {r.suggestion.name}</div>
                        )}
                      </td>
                      <td style={{ padding: "7px 10px", color: "#64748b" }}>{Object.keys(r.subMarks || {}).length}/{subjects.length} subjects</td>
                      <td style={{ padding: "7px 10px" }}>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                          {r.status !== "new" && <button onClick={() => markAsNew(r.idx)} style={{ ...css.btn, padding: "3px 8px", fontSize: 10.5, background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0" }}>+ New</button>}
                          <button onClick={() => setManualOpenIdx(manualOpenIdx === r.idx ? null : r.idx)} style={{ ...css.btn, padding: "3px 8px", fontSize: 10.5, background: "#EEF2FF", color: "#4338CA", border: "1px solid #C7D2FE" }}>🔍 Pick manually</button>
                          {r.status !== "skip" && <button onClick={() => markSkip(r.idx)} style={{ ...css.btn, padding: "3px 8px", fontSize: 10.5, background: "#F3F4F6", color: "#6B7280" }}>Skip</button>}
                        </div>
                        {manualOpenIdx === r.idx && (
                          <div style={{ marginTop: 6 }}>
                            <input placeholder="Search existing students…" value={manualSearch[r.idx] || ""} onChange={e => setManualSearch(p => ({ ...p, [r.idx]: e.target.value }))} style={{ ...css.input, fontSize: 11, padding: "4px 8px" }} />
                            <div style={{ maxHeight: 140, overflowY: "auto", marginTop: 4, border: "1px solid #E5E7EB", borderRadius: 6 }}>
                              {students
                                .filter(s => {
                                  const q = (manualSearch[r.idx] || "").toLowerCase();
                                  return !q || (s.name || "").toLowerCase().includes(q) || String(s.gcc_no ?? "").includes(q);
                                })
                                .slice(0, 25)
                                .map(s => (
                                  <div key={s.id} onClick={() => { markManualMatch(r.idx, s); setManualOpenIdx(null); }}
                                    style={{ padding: "4px 8px", fontSize: 11, cursor: "pointer", borderBottom: "1px solid #F1F5F9" }}
                                    onMouseEnter={e => e.currentTarget.style.background = "#F9FAFB"}
                                    onMouseLeave={e => e.currentTarget.style.background = "white"}>
                                    {s.name} — GCC {s.gcc_no} ({s.class_name})
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {missingStudents.length > 0 && (
              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: 14, marginBottom: 14 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#92400E", marginBottom: 6 }}>⚠️ {missingStudents.length} student(s) already on the {batch} roster were not found in this result sheet:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {missingStudents.map(s => (
                    <span key={s.id} style={{ fontSize: 11, background: "white", border: "1px solid #FDE68A", borderRadius: 999, padding: "2px 9px", color: "#92400E" }}>{s.name} · GCC {s.gcc_no || "—"}</span>
                  ))}
                </div>
              </div>
            )}

            {gccConflicts.length > 0 && (
              <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 14px", marginBottom: 14, fontSize: 12.5, color: "#991B1B" }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>⚠️ {gccConflicts.length} row(s) marked "New" have a GCC No. that already exists in the system:</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                  {gccConflicts.map(r => (
                    <span key={r.idx} style={{ fontSize: 11, background: "white", border: "1px solid #FECACA", borderRadius: 999, padding: "2px 9px" }}>{r.rawName} (GCC {r.rawGcc})</span>
                  ))}
                </div>
                Import is blocked until these are resolved — use <b>🔍 Pick manually</b> to match them to the existing student, or correct the GCC No. and re-upload.
              </div>
            )}

            {saveSummary && (
              <div style={{ background: saveSummary.ok ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${saveSummary.ok ? "#BBF7D0" : "#FECACA"}`, color: saveSummary.ok ? "#166534" : "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 13, marginBottom: 8 }}>
                {saveSummary.ok
                  ? (saveSummary.message || `✅ Added ${saveSummary.added} new student(s), matched ${saveSummary.matched} existing, wrote ${saveSummary.marksWritten} mark entries. ${saveSummary.skipped} row(s) skipped.`)
                  : `⚠️ ${saveSummary.message}`}
              </div>
            )}
            {saveSummary?.ok && !(examTime.trim() && examRoom.trim()) && (
              <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "9px 14px", marginBottom: 14, fontSize: 12, color: "#92400E" }}>
                ℹ️ Time/Room weren't set for this sitting, so Admit Cards won't have a time/hall to print yet — fill those in under <b>Schedule</b> if you need admit cards for it.
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => { setRawRows(null); setHeaders([]); setRows([]); setSaveSummary(null); }} style={{ ...css.btn, background: "#F3F4F6", color: "#374151" }}>← Start Over</button>
              <button onClick={handleImportAll} disabled={saving || !examTypeId || !examDate || gccConflicts.length > 0} style={{ ...css.btn, background: saving ? "#93C5FD" : gccConflicts.length ? "#D1D5DB" : "#1a3c2e", color: "white", flex: 1 }}>
                {saving ? "⏳ Importing…" : gccConflicts.length ? "⚠️ Resolve GCC conflicts above first" : `✅ Import Roster + Marks (${rows.length - skipCount} students)`}
              </button>
              <button onClick={onDone} style={{ ...css.btn, background: "#F3F4F6", color: "#374151" }}>Done</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function ExamAbsentFinder({ courseSubjects, students, onStudentsChange, onClose }) {
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const [examTypeId, setExamTypeId] = useState("");
  const [examTypesList, setExamTypesList] = useState([]);
  const [examDate, setExamDate] = useState("");
  const [availableDates, setAvailableDates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [absentees, setAbsentees] = useState(null); // null = not searched yet
  const [selected, setSelected] = useState(new Set());
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    supabase.from("exam_types").select("*").order("created_at").then(({ data }) => setExamTypesList(data || []));
  }, []);

  useEffect(() => {
    if (!examTypeId) { setAvailableDates([]); return; }
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examTypeId).then(({ data }) => {
      setAvailableDates([...new Set((data || []).map(d => d.exam_date).filter(Boolean))].sort());
    });
  }, [examTypeId]);

  const search = async () => {
    if (!course || !examTypeId) return;
    setLoading(true); setAbsentees(null); setSelected(new Set()); setResult(null);

    const { data: schedData } = await supabase
      .from("exam_schedule")
      .select("id")
      .eq("exam_type_id", examTypeId)
      .eq("course", course);
    const examIds = (schedData || []).map(s => s.id);
    if (!examIds.length) { setAbsentees([]); setLoading(false); return; }

    const courseStudents = students.filter(s => (s.class_name || "").toUpperCase() === course.toUpperCase() && s.status !== "Dropout");
    const ids = courseStudents.map(s => s.id);
    if (!ids.length) { setAbsentees([]); setLoading(false); return; }

    let q = supabase.from("exam_marks").select("student_id, exam_id, marks_obtained, exam_date").in("student_id", ids).in("exam_id", examIds);
    if (examDate) q = q.eq("exam_date", examDate);
    const { data: marksData } = await q;

    // Group marks by student. A student counts as "absent" for this sitting if
    // every subject they have a row for is 0 AND they have a row for every
    // scheduled subject (so a student simply not yet entered isn't flagged).
    const byStudent = {};
    (marksData || []).forEach(m => {
      byStudent[m.student_id] = byStudent[m.student_id] || [];
      byStudent[m.student_id].push(m);
    });

    const absent = courseStudents.filter(s => {
      const rows = byStudent[s.id] || [];
      if (rows.length < examIds.length) return false; // incomplete entry, not confirmed absent
      return rows.every(r => Number(r.marks_obtained) === 0);
    });

    setAbsentees(absent);
    setLoading(false);
  };

  const toggleSel = (id) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  const applyAction = async (action) => {
    if (!selected.size) return;
    setApplying(true);
    const ids = [...selected];
    if (action === "dropout") {
      const { error } = await supabase.from("students").update({ status: "Dropout" }).in("id", ids);
      if (!error) onStudentsChange(students.map(s => selected.has(s.id) ? { ...s, status: "Dropout" } : s));
      setResult(error ? { ok: false, message: error.message } : { ok: true, message: `Marked ${ids.length} student(s) as Dropout.` });
    } else if (action === "delete") {
      const { error } = await supabase.from("students").delete().in("id", ids);
      if (!error) onStudentsChange(students.filter(s => !selected.has(s.id)));
      setResult(error ? { ok: false, message: error.message } : { ok: true, message: `Permanently removed ${ids.length} student(s).` });
    }
    setApplying(false);
    if (absentees) setAbsentees(absentees.filter(s => !selected.has(s.id)));
    setSelected(new Set());
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto" }}>
      <div style={{ background: "white", borderRadius: 14, padding: 24, maxWidth: 640, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", marginTop: 30 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 600 }}>🚫 Find Exam-Absent Students</div>
          <button onClick={onClose} style={{ ...css.btn, padding: "4px 10px", background: "#F3F4F6", color: "#374151" }}>✕</button>
        </div>
        <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 16 }}>
          Finds students marked absent (0 in every subject) for a given exam sitting, so they can be removed from the active roster or marked Dropout in bulk.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>Batch / Course</label>
            <select value={course} onChange={e => setCourse(e.target.value)} style={css.input}>
              {courses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>Exam Type</label>
            <select value={examTypeId} onChange={e => { setExamTypeId(e.target.value); setExamDate(""); }} style={css.input}>
              <option value="">— Select —</option>
              {examTypesList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4 }}>Exam Date (optional — leave blank to check all dates for this type)</label>
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={css.input}>
            <option value="">— All dates —</option>
            {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <button onClick={search} disabled={loading || !course || !examTypeId} style={{ ...css.btn, background: "#1a3c2e", color: "white", marginBottom: 16 }}>
          {loading ? "⏳ Searching…" : "🔎 Find Absent Students"}
        </button>

        {absentees !== null && (
          <div>
            {absentees.length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>No fully-absent students found for this sitting.</div>
            ) : (
              <>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#DC2626", marginBottom: 8 }}>{absentees.length} student(s) absent for every subject:</div>
                <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: 10, marginBottom: 14 }}>
                  {absentees.map(s => (
                    <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid #F1F5F9", fontSize: 12.5, cursor: "pointer" }}>
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSel(s.id)} />
                      <span style={{ fontWeight: 600 }}>{s.name}</span>
                      <span style={{ color: "#94A3B8" }}>GCC {s.gcc_no} · {s.class_name}</span>
                    </label>
                  ))}
                </div>
                {result && (
                  <div style={{ background: result.ok ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${result.ok ? "#BBF7D0" : "#FECACA"}`, color: result.ok ? "#166534" : "#DC2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>
                    {result.ok ? "✅ " : "⚠️ "}{result.message}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={() => applyAction("dropout")} disabled={applying || !selected.size} style={{ ...css.btn, background: applying ? "#93C5FD" : "#B45309", color: "white" }}>
                    📤 Mark Selected as Dropout
                  </button>
                  <button onClick={() => applyAction("delete")} disabled={applying || !selected.size} style={{ ...css.btn, background: applying ? "#FCA5A5" : "#DC2626", color: "white" }}>
                    🗑️ Delete Selected Permanently
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── FIX CORRUPTED BATCH SUFFIXES (one-click cleanup for the section-tag bug) ──
// An earlier version of the Result Sheet Import mistakenly appended a section
// suffix (e.g. " — ENG") onto an EXISTING matched student's real `batch`
// field — turning "ACHIEVER" into "ACHIEVER — ENG" — instead of recording it
// as a proper secondary-batch link. This left `class_name` (their real batch,
// unaffected) and `batch` (corrupted) out of sync, which is what produces the
// confusing "Achiever — ENG" pill shown in the roster. This tool finds every
// student where stripping a trailing " — SUFFIX" from `batch` would exactly
// match their real `class_name`, and offers to restore `batch` back to it.
function BatchSuffixCleanupTool({ students, onStudentsChange, secondaryBatchMap, onSecondaryBatchesChange, onClose }) {
  const [scanning, setScanning] = useState(true);
  const [affected, setAffected] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);

  const SUFFIX_RE = /\s+—\s+([A-Za-z]+)$/;

  // Maps the extracted suffix to the batch it actually should have been
  // recorded as a secondary batch for. Confirmed exact names: "ENG" → the
  // English-medium Combined Navodaya batch, "MM" → the Manipuri-medium one.
  const SUFFIX_TO_SECONDARY_BATCH = {
    ENG: "Combined Navodaya Course(ENG)",
    MM: "Combined Navodaya Course (MM)",
  };

  useEffect(() => {
    // No DB round-trip needed — the same `batch` value already loaded into
    // `students` is enough to detect this locally.
    const found = students.filter(s => {
      const batch = s.batch || "";
      if (!SUFFIX_RE.test(batch)) return false;
      const stripped = batch.replace(SUFFIX_RE, "");
      // class_name is always stored UPPERCASE everywhere in this app (see
      // every insert path: `class_name: batchVal.toUpperCase()`), while
      // `batch` preserves whatever case it was originally typed in ("Leader"
      // vs "LEADER") — comparing them directly here silently found ZERO
      // matches even on real corrupted rows, because "Leader" !== "LEADER".
      return stripped.trim().toUpperCase() === (s.class_name || "").trim().toUpperCase();
    }).map(s => {
      const suffix = (s.batch.match(SUFFIX_RE) || ["", ""])[1].toUpperCase();
      const correctSecondaryBatch = SUFFIX_TO_SECONDARY_BATCH[suffix] || null;
      const currentSecondaryBatches = secondaryBatchMap?.[s.id] || [];
      // Flag any EXISTING secondary tag that starts with "Combined Navodaya
      // Course" but isn't the one this suffix actually points to — that's the
      // bug's blanket mis-assignment (e.g. an ENG student tagged "(MM)").
      const wrongSecondaryBatches = currentSecondaryBatches.filter(b =>
        b.startsWith("Combined Navodaya Course") && b !== correctSecondaryBatch
      );
      return {
        ...s,
        _restoredBatch: s.batch.replace(SUFFIX_RE, "").trim(), // preserves original mixed case, e.g. "Leader" not "LEADER"
        _extractedSuffix: suffix,
        _correctSecondaryBatch: correctSecondaryBatch,
        _alreadyHasCorrectTag: correctSecondaryBatch ? currentSecondaryBatches.includes(correctSecondaryBatch) : false,
        _wrongSecondaryBatches: wrongSecondaryBatches,
      };
    });
    setAffected(found);
    setSelected(new Set(found.map(s => s.id)));
    setScanning(false);
  }, [students, secondaryBatchMap]);

  const toggleSel = (id) => setSelected(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectAll = () => setSelected(new Set(affected.map(s => s.id)));
  const deselectAll = () => setSelected(new Set());

  const applyFix = async () => {
    if (!selected.size) return;
    setApplying(true);
    const toFix = affected.filter(s => selected.has(s.id));
    const errors = [];

    for (const s of toFix) {
      // 1) Restore the real primary batch (strip the corrupted suffix).
      const { error: batchErr } = await supabase.from("students").update({ batch: s._restoredBatch }).eq("id", s.id);
      if (batchErr) { errors.push(`${s.name}: ${batchErr.message}`); continue; }

      // 2) Remove any WRONG "Combined Navodaya Course..." secondary tag the
      // bug applied (e.g. tagged "(MM)" when the student is actually ENG).
      for (const wrongBatch of s._wrongSecondaryBatches) {
        const { error } = await supabase.from("student_secondary_batches").delete().eq("student_id", s.id).eq("batch", wrongBatch);
        if (error) errors.push(`${s.name} (removing "${wrongBatch}"): ${error.message}`);
      }

      // 3) Add the CORRECT secondary batch based on the suffix that was
      // extracted (ENG/MM), if it isn't already there.
      if (s._correctSecondaryBatch && !s._alreadyHasCorrectTag) {
        const { error } = await supabase.from("student_secondary_batches")
          .upsert([{ student_id: s.id, batch: s._correctSecondaryBatch }], { onConflict: "student_id,batch" });
        if (error) errors.push(`${s.name} (adding "${s._correctSecondaryBatch}"): ${error.message}`);
      }
    }

    setApplying(false);
    onSecondaryBatchesChange?.(); // refetch the secondary-batch map so counts update
    if (errors.length) {
      setResult({ ok: false, message: `${errors.length} operation(s) failed: ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ""}` });
    } else {
      setResult({ ok: true, message: `Fixed ${toFix.length} student(s) — batch restored and correctly tagged by section (ENG/MM).` });
    }
    const fixedIds = new Set(toFix.map(s => s.id));
    const restoredBatchById = new Map(toFix.map(s => [s.id, s._restoredBatch]));
    onStudentsChange(students.map(s => fixedIds.has(s.id) ? { ...s, batch: restoredBatchById.get(s.id) } : s));
    setAffected(prev => prev.filter(s => !fixedIds.has(s.id)));
    setSelected(new Set());
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto" }}>
      <div style={{ background: "white", borderRadius: 14, padding: 24, maxWidth: 680, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", marginTop: 30 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 600 }}>🧹 Fix Corrupted Batch Suffixes</div>
          <button onClick={onClose} style={{ ...css.btn, padding: "4px 10px", background: "#F3F4F6", color: "#374151" }}>✕</button>
        </div>
        <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 16 }}>
          Finds students whose Batch shows a stray suffix like "Achiever — ENG" from an earlier import bug. For each one, this: restores
          their Batch to the real value ("Achiever"), removes any wrong "Combined Navodaya Course..." tag the bug applied, and adds the
          <b> correct</b> one based on their actual section — ENG → <code>Combined Navodaya Course(ENG)</code>, MM → <code>Combined Navodaya Course (MM)</code>.
        </div>

        {scanning ? (
          <div style={{ padding: 24, textAlign: "center", color: "#9CA3AF" }}>Scanning…</div>
        ) : affected.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#0F6E56", fontWeight: 600 }}>✅ No corrupted batch suffixes found. Nothing to fix.</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button onClick={selectAll} style={{ ...css.btn, padding: "5px 10px", fontSize: 11, background: "#E0F2FE", color: "#0369A1" }}>Select All</button>
              <button onClick={deselectAll} style={{ ...css.btn, padding: "5px 10px", fontSize: 11, background: "#FEF2F2", color: "#DC2626" }}>Deselect All</button>
              <div style={{ fontSize: 12, color: "#9CA3AF", alignSelf: "center" }}>{affected.length} affected</div>
            </div>
            <div style={{ maxHeight: 380, overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: 10, marginBottom: 14 }}>
              {affected.map(s => (
                <label key={s.id} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 12px", borderBottom: "1px solid #F1F5F9", fontSize: 12.5, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSel(s.id)} />
                    <span style={{ fontWeight: 600, flex: 1 }}>{s.name}</span>
                    <span style={{ color: "#94A3B8" }}>GCC {s.gcc_no}</span>
                    <span style={{ background: "#FEF2F2", color: "#DC2626", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{s.batch}</span>
                    <span style={{ color: "#9CA3AF" }}>→</span>
                    <span style={{ background: "#E1F5EE", color: "#0F6E56", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{s._restoredBatch}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingLeft: 24 }}>
                    {s._wrongSecondaryBatches.map(b => (
                      <span key={b} style={{ fontSize: 10.5, background: "#FEF2F2", color: "#DC2626", padding: "1px 7px", borderRadius: 999, textDecoration: "line-through" }}>{b}</span>
                    ))}
                    {s._correctSecondaryBatch && (
                      <span style={{ fontSize: 10.5, background: s._alreadyHasCorrectTag ? "#F5F3FF" : "#ECFDF5", color: s._alreadyHasCorrectTag ? "#7c3aed" : "#047857", padding: "1px 7px", borderRadius: 999, fontWeight: 700 }}>
                        {s._alreadyHasCorrectTag ? "✓ " : "+ "}{s._correctSecondaryBatch}
                      </span>
                    )}
                  </div>
                </label>
              ))}
            </div>
            {result && (
              <div style={{ background: result.ok ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${result.ok ? "#BBF7D0" : "#FECACA"}`, color: result.ok ? "#166534" : "#DC2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>
                {result.ok ? "✅ " : "⚠️ "}{result.message}
              </div>
            )}
            <button onClick={applyFix} disabled={applying || !selected.size} style={{ ...css.btn, background: applying ? "#93C5FD" : "#1a3c2e", color: "white", width: "100%" }}>
              {applying ? "⏳ Fixing…" : `✅ Fix ${selected.size} Selected Student(s)`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── RESOLVE DUPLICATE SECTION TAGS (ENG + MM at once) ─────────────────────────
// A student who imported into both the ENG and MM Combined Navodaya sections
// (leftover from the earlier import bug) still has BOTH secondary-batch tags
// at once. That's not just cosmetic — every exam-facing tab (Mark Entry,
// Report Cards, Bulk Reports, Admit Cards) generates one "phantom" roster
// entry per secondary batch, so selecting EITHER "Combined Navodaya
// Course(ENG)" or "Combined Navodaya Course (MM)" legitimately shows this
// student, since they really do have both tags. This tool finds everyone with
// both and lets you pick which one is correct, removing the other.
function DuplicateSectionTagResolver({ students, secondaryBatchMap, onSecondaryBatchesChange, onClose }) {
  const ENG = "Combined Navodaya Course(ENG)";
  const MM = "Combined Navodaya Course (MM)";
  const [affected, setAffected] = useState([]);
  const [resolving, setResolving] = useState(null); // student id currently being resolved (single) or "bulk" during a bulk run
  const [resolved, setResolved] = useState(new Set());
  const [err, setErr] = useState("");
  const [excluded, setExcluded] = useState(new Set()); // student ids to skip during a bulk resolve
  const [bulkResult, setBulkResult] = useState(null);

  useEffect(() => {
    const found = students.filter(s => {
      const tags = secondaryBatchMap?.[s.id] || [];
      return tags.includes(ENG) && tags.includes(MM);
    });
    setAffected(found);
  }, [students, secondaryBatchMap]);

  const resolve = async (student, keep) => {
    const remove = keep === ENG ? MM : ENG;
    setErr(""); setResolving(student.id);
    const { error } = await supabase.from("student_secondary_batches").delete().eq("student_id", student.id).eq("batch", remove);
    setResolving(null);
    if (error) { setErr(`${student.name}: ${error.message}`); return; }
    onSecondaryBatchesChange?.();
    setResolved(prev => new Set(prev).add(student.id));
  };

  const remaining = affected.filter(s => !resolved.has(s.id));
  const toggleExclude = (id) => setExcluded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // Bulk-resolve: applies the SAME keep-decision to every remaining student
  // except any explicitly excluded via checkbox — useful when, like here, an
  // entire batch of students came from one file (e.g. all 42 from the ENG
  // result sheet) and should uniformly keep that one section.
  const bulkResolve = async (keep) => {
    const remove = keep === ENG ? MM : ENG;
    const toResolve = remaining.filter(s => !excluded.has(s.id));
    if (!toResolve.length) return;
    if (!window.confirm(`Keep "${keep}" and remove "${remove}" for ${toResolve.length} student(s)? This cannot be undone.`)) return;
    setErr(""); setResolving("bulk"); setBulkResult(null);
    const errors = [];
    for (const s of toResolve) {
      const { error } = await supabase.from("student_secondary_batches").delete().eq("student_id", s.id).eq("batch", remove);
      if (error) errors.push(`${s.name}: ${error.message}`);
    }
    setResolving(null);
    onSecondaryBatchesChange?.();
    setResolved(prev => new Set([...prev, ...toResolve.filter(s => !errors.some(e => e.startsWith(s.name + ":"))).map(s => s.id)]));
    setBulkResult(errors.length
      ? { ok: false, message: `${toResolve.length - errors.length} resolved, ${errors.length} failed: ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ""}` }
      : { ok: true, message: `Resolved ${toResolve.length} student(s) — kept "${keep}" for all.` });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto" }}>
      <div style={{ background: "white", borderRadius: 14, padding: 24, maxWidth: 680, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", marginTop: 30 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 600 }}>🔀 Resolve Duplicate Section Tags</div>
          <button onClick={onClose} style={{ ...css.btn, padding: "4px 10px", background: "#F3F4F6", color: "#374151" }}>✕</button>
        </div>
        <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 16 }}>
          These students are tagged into BOTH Combined Navodaya sections at once — leftover from an earlier import mix-up. That's why
          selecting either "Combined Navodaya Course(ENG)" or "Combined Navodaya Course (MM)" shows them: they genuinely have both
          tags right now. Pick which section each one actually belongs to; the other tag will be removed. Uncheck anyone below who
          should be handled individually instead, then use the bulk buttons for everyone else.
        </div>

        {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 12.5, marginBottom: 14 }}>⚠️ {err}</div>}
        {bulkResult && (
          <div style={{ background: bulkResult.ok ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${bulkResult.ok ? "#BBF7D0" : "#FECACA"}`, color: bulkResult.ok ? "#166534" : "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 12.5, marginBottom: 14 }}>
            {bulkResult.ok ? "✅ " : "⚠️ "}{bulkResult.message}
          </div>
        )}

        {remaining.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#0F6E56", fontWeight: 600 }}>
            {affected.length === 0 ? "✅ No students currently have both tags. Nothing to resolve." : "✅ All resolved."}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>Bulk resolve {remaining.length - excluded.size} of {remaining.length}:</span>
              <button onClick={() => bulkResolve(ENG)} disabled={resolving !== null}
                style={{ ...css.btn, padding: "6px 14px", fontSize: 12, background: "#1D4ED8", color: "white" }}>
                {resolving === "bulk" ? "⏳ Working…" : "Keep ENG for All"}
              </button>
              <button onClick={() => bulkResolve(MM)} disabled={resolving !== null}
                style={{ ...css.btn, padding: "6px 14px", fontSize: 12, background: "#7c3aed", color: "white" }}>
                {resolving === "bulk" ? "⏳ Working…" : "Keep MM for All"}
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto" }}>
              {remaining.map(s => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 10, background: excluded.has(s.id) ? "#FFFBEB" : "#F9FAFB" }}>
                  <input type="checkbox" checked={!excluded.has(s.id)} onChange={() => toggleExclude(s.id)} title="Uncheck to exclude from bulk actions" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: "#94A3B8" }}>GCC {s.gcc_no ?? "—"} · real batch: {s.class_name || "—"}</div>
                  </div>
                  <button onClick={() => resolve(s, ENG)} disabled={resolving !== null}
                    style={{ ...css.btn, padding: "6px 14px", fontSize: 12, background: "#EFF6FF", color: "#1D4ED8", border: "1px solid #BFDBFE" }}>
                    {resolving === s.id ? "…" : "Keep ENG"}
                  </button>
                  <button onClick={() => resolve(s, MM)} disabled={resolving !== null}
                    style={{ ...css.btn, padding: "6px 14px", fontSize: 12, background: "#F5F3FF", color: "#7c3aed", border: "1px solid #DDD6FE" }}>
                    {resolving === s.id ? "…" : "Keep MM"}
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── MERIT LIST ───────────────────────────────────────────────────────────────
function MeritList({ courseSubjects, examTypes, students }) {
  const isMobile = useMobile();
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course.toUpperCase()
  );
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState("");
  const [marks, setMarks] = useState({});
  const [dates, setDates] = useState([]);
  const [rankFilter, setRankFilter] = useState("");
  // ── Real exam config, sourced live from exam_schedule for this exact course +
  // exam type — NOT the static courseSubjects/COURSE_MAX_MARKS config.
  const [scheduledSubjects, setScheduledSubjects] = useState([]);

  useEffect(() => {
    if (!examType) return;
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]);
    });
  }, [examType]);

  useEffect(() => {
    if (!examType || !course) { setScheduledSubjects([]); return; }
    supabase.from("exam_schedule").select("id, subject, total_marks").eq("exam_type_id", examType).eq("course", course).order("exam_date").then(({ data }) => {
      setScheduledSubjects(data || []);
    });
  }, [examType, course]);

  const subjects = scheduledSubjects.length ? scheduledSubjects.map(s => s.subject) : (courseSubjects[course] || []);
  const courseMax = scheduledSubjects.length
    ? scheduledSubjects.reduce((sum, s) => sum + (Number(s.total_marks) || 0), 0)
    : getCourseMax(course);

  useEffect(() => {
    if (!examType || !examDate) return;
    const ids = courseStudents.map(s => s.id);
    // Resolve marks via exam_schedule (exam_id -> subject) instead of trusting the
    // raw `subject` text column on exam_marks directly — that column can be null/stale
    // on older rows or out of sync with the current schedule, which silently dropped
    // marks here even though Mark Entry (which joins via exam_id) could see them fine.
    supabase.from("exam_schedule").select("id, subject").eq("exam_type_id", examType).eq("course", course).then(({ data: sched }) => {
        const examIdToSubject = {};
        (sched || []).forEach(s => { examIdToSubject[s.id] = s.subject; });
        const scopedExamIds = (sched || []).map(s => s.id);
        if (!scopedExamIds.length) { setMarks({}); return; }
        supabase.from("exam_marks").select("student_id, exam_id, marks_obtained").eq("exam_type_id", examType).in("student_id", ids.length ? ids : ["__none__"]).in("exam_id", scopedExamIds).then(({ data }) => {
          const map = {};
          (data || []).forEach(r => {
            const sub = examIdToSubject[r.exam_id];
            if (sub) map[`${r.student_id}-${sub}`] = r.marks_obtained;
          });
          setMarks(map);
        });
    });
  }, [examType, course, examDate]);

  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);
  const ranked = [...courseStudents].map(st => ({ ...st, total: getTotal(st.id), pct: courseMax ? (getTotal(st.id) / courseMax) * 100 : 0 })).sort((a, b) => b.total - a.total);
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
// ─── RENAME COURSE / BATCH (cascading — touches every table that stores it) ───
// A course/batch name is stored as plain text (not a foreign key) in several
// places: students.class_name, students.batch, exam_schedule.course,
// exam_marks.class_name, student_secondary_batches.batch, the live
// course_subjects config, and any saved custom Exam Config presets
// (courseSubjects + courseMaxMarks keys). Renaming it means updating all of
// these together — missing even one leaves that batch split into two names
// with data silently orphaned under the old one.
function RenameCourseModal({ courseSubjects, oldName, onClose, onDone, onCourseSubjectsUpdate }) {
  const [newName, setNewName] = useState(oldName);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [progress, setProgress] = useState("");
  const [affectedCounts, setAffectedCounts] = useState(null); // preview counts, loaded on open

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ count: studentCount }, { count: schedCount }, { count: marksCount }, { count: secCount }] = await Promise.all([
        supabase.from("students").select("*", { count: "exact", head: true }).eq("class_name", oldName),
        supabase.from("exam_schedule").select("*", { count: "exact", head: true }).eq("course", oldName),
        supabase.from("exam_marks").select("*", { count: "exact", head: true }).eq("class_name", oldName),
        supabase.from("student_secondary_batches").select("*", { count: "exact", head: true }).eq("batch", oldName),
      ]);
      if (!cancelled) {
        setAffectedCounts({
          students: studentCount || 0,
          schedule: schedCount || 0,
          marks: marksCount || 0,
          secondary: secCount || 0,
        });
      }
    })();
    return () => { cancelled = true; };
  }, [oldName]);

  const rename = async () => {
    const trimmed = newName.trim();
    if (!trimmed) { setErr("New name can't be empty."); return; }
    if (trimmed === oldName) { setErr("That's the same name — nothing to rename."); return; }
    if (courseSubjects[trimmed]) { setErr(`"${trimmed}" already exists as a separate course. Merging two courses isn't supported here — pick a name that doesn't already exist.`); return; }

    setErr(""); setSaving(true);
    const errors = [];

    // 1) students — both class_name (what everything filters on) and the
    // legacy `batch` field, but ONLY when batch matches the old name exactly
    // (batch may carry a " — SECTION" suffix, which must be preserved).
    setProgress("Updating students…");
    {
      const { error } = await supabase.from("students").update({ class_name: trimmed }).eq("class_name", oldName);
      if (error) errors.push(`students.class_name: ${error.message}`);
    }
    {
      const { error } = await supabase.from("students").update({ batch: trimmed }).eq("batch", oldName);
      if (error) errors.push(`students.batch (exact): ${error.message}`);
    }
    // Students whose batch carries a section suffix (e.g. "OLDNAME — ENG")
    // need that suffix preserved across the rename.
    {
      const { data: withSuffix } = await supabase.from("students").select("id, batch").ilike("batch", `${oldName} — %`);
      for (const s of withSuffix || []) {
        const suffix = s.batch.slice(oldName.length);
        const { error } = await supabase.from("students").update({ batch: trimmed + suffix }).eq("id", s.id);
        if (error) errors.push(`students.batch (suffixed, id ${s.id}): ${error.message}`);
      }
    }

    // 2) exam_schedule.course
    setProgress("Updating exam schedule…");
    {
      const { error } = await supabase.from("exam_schedule").update({ course: trimmed }).eq("course", oldName);
      if (error) errors.push(`exam_schedule.course: ${error.message}`);
    }

    // 3) exam_marks.class_name (denormalized label on each mark row)
    setProgress("Updating exam marks…");
    {
      const { error } = await supabase.from("exam_marks").update({ class_name: trimmed }).eq("class_name", oldName);
      if (error) errors.push(`exam_marks.class_name: ${error.message}`);
    }

    // 4) student_secondary_batches.batch
    setProgress("Updating secondary batch tags…");
    {
      const { error } = await supabase.from("student_secondary_batches").update({ batch: trimmed }).eq("batch", oldName);
      if (error) errors.push(`student_secondary_batches.batch: ${error.message}`);
    }

    // 5) live course_subjects config (the key itself, keeping its subject list)
    setProgress("Updating course/subject config…");
    const updatedCourseSubjects = {};
    for (const [k, v] of Object.entries(courseSubjects)) {
      updatedCourseSubjects[k === oldName ? trimmed : k] = v;
    }
    {
      const { error } = await supabase.from("system_settings").upsert(
        { key: "course_subjects", value: JSON.stringify(updatedCourseSubjects) },
        { onConflict: "key" }
      );
      if (error) errors.push(`course_subjects config: ${error.message}`);
    }

    // 6) any saved CUSTOM exam config presets — patch both courseSubjects and
    // courseMaxMarks keys inside each one. Built-in presets (EXAM_CONFIG_PRESETS)
    // are a hardcoded JS constant, not user data, so they're intentionally left
    // untouched — there's nothing to persist for them anyway.
    setProgress("Updating saved exam config presets…");
    {
      const { data: cfgRow } = await supabase.from("system_settings").select("value").eq("key", "exam_configs").single();
      if (cfgRow?.value) {
        try {
          const customConfigs = JSON.parse(cfgRow.value);
          const patched = customConfigs.map(cfg => {
            const next = { ...cfg };
            if (next.courseSubjects && next.courseSubjects[oldName] !== undefined) {
              const cs = {};
              for (const [k, v] of Object.entries(next.courseSubjects)) cs[k === oldName ? trimmed : k] = v;
              next.courseSubjects = cs;
            }
            if (next.courseMaxMarks && next.courseMaxMarks[oldName] !== undefined) {
              const cm = {};
              for (const [k, v] of Object.entries(next.courseMaxMarks)) cm[k === oldName ? trimmed : k] = v;
              next.courseMaxMarks = cm;
            }
            return next;
          });
          const { error } = await supabase.from("system_settings").upsert(
            { key: "exam_configs", value: JSON.stringify(patched) },
            { onConflict: "key" }
          );
          if (error) errors.push(`exam_configs presets: ${error.message}`);
        } catch (e) {
          errors.push(`exam_configs presets: could not parse saved config JSON — left untouched, check manually.`);
        }
      }
    }

    setProgress("");
    setSaving(false);

    if (errors.length) {
      setErr(`Partially completed with ${errors.length} error(s): ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ""}. Some data may still reference the old name — check the affected tables before relying on the new name everywhere.`);
      return;
    }

    onCourseSubjectsUpdate?.(updatedCourseSubjects);
    onDone(trimmed);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 14, padding: 24, maxWidth: 520, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 600, marginBottom: 6 }}>✏️ Rename Course / Batch</div>
        <div style={{ fontSize: 12.5, color: "#64748b", marginBottom: 16 }}>
          This renames <b>"{oldName}"</b> everywhere — every student assigned to it, every schedule entry, every exam mark record,
          every secondary-batch tag, and any saved Exam Config presets that reference it. This cannot be easily undone; the old name
          will no longer exist anywhere in the app afterward.
        </div>

        {affectedCounts && (
          <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12.5 }}>
            <div style={{ fontWeight: 700, color: "#374151", marginBottom: 6 }}>This will affect:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Badge label={`${affectedCounts.students} student(s)`} color="#0369A1" bg="#E0F2FE" />
              <Badge label={`${affectedCounts.schedule} schedule entr${affectedCounts.schedule === 1 ? "y" : "ies"}`} color="#0F6E56" bg="#E1F5EE" />
              <Badge label={`${affectedCounts.marks} mark record(s)`} color="#92740C" bg="#FEF9E7" />
              {affectedCounts.secondary > 0 && <Badge label={`${affectedCounts.secondary} secondary-batch tag(s)`} color="#7c3aed" bg="#F5F3FF" />}
            </div>
          </div>
        )}

        {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 12.5, marginBottom: 14 }}>⚠️ {err}</div>}

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 6, textTransform: "uppercase" }}>New Name</label>
          <input value={newName} onChange={e => setNewName(e.target.value)} style={css.input} disabled={saving} autoFocus />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} disabled={saving} style={{ ...css.btn, flex: 1, background: "#F3F4F6", color: "#374151" }}>Cancel</button>
          <button onClick={rename} disabled={saving || !newName.trim() || newName.trim() === oldName}
            style={{ ...css.btn, flex: 2, background: saving ? "#93C5FD" : "#DC2626", color: "white" }}>
            {saving ? `⏳ ${progress || "Renaming…"}` : "✅ Rename Everywhere"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CourseSubjectsManager({ courseSubjects, onUpdate }) {
  const courses = Object.keys(courseSubjects);
  const [selected, setSelected] = useState(courses[0] || "");
  const [list, setList] = useState(courseSubjects[selected] || []);
  const [newSub, setNew] = useState("");
  const [newCourse, setNewCourse] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [renamingCourse, setRenamingCourse] = useState(null); // course name currently being renamed

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
            <div key={c} style={{ display: "flex", alignItems: "stretch" }}>
              <button onClick={() => setSelected(c)}
                style={{ ...css.btn, padding: "6px 16px", background: selected === c ? "#1a3c2e" : "#F3F4F6", color: selected === c ? "white" : "#374151", border: "1.5px solid " + (selected === c ? "#1a3c2e" : "#E5E7EB"), borderRadius: "8px 0 0 8px" }}>
                {c} <span style={{ fontSize: 11, opacity: 0.7 }}>({(courseSubjects[c] || []).length})</span>
              </button>
              <button onClick={() => setRenamingCourse(c)} title={`Rename "${c}" everywhere (students, schedule, marks, configs)`}
                style={{ ...css.btn, padding: "6px 10px", background: selected === c ? "#14532d" : "#E5E7EB", color: selected === c ? "white" : "#6B7280", border: "1.5px solid " + (selected === c ? "#1a3c2e" : "#E5E7EB"), borderLeft: "none", borderRadius: "0 8px 8px 0", fontSize: 12 }}>
                ✏️
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6 }}>
            <input value={newCourse} onChange={e => setNewCourse(e.target.value)} placeholder="New course…" style={{ ...css.input, width: 120, fontSize: 12 }}
              onKeyDown={e => { if (e.key === "Enter") addCourse(); }} />
            <button onClick={addCourse} style={{ ...css.btn, padding: "6px 12px", background: "#E0F2FE", color: "#0369A1", fontSize: 12 }}>+ Add</button>
          </div>
        </div>

        {renamingCourse && (
          <RenameCourseModal
            courseSubjects={courseSubjects}
            oldName={renamingCourse}
            onClose={() => setRenamingCourse(null)}
            onDone={(newName) => {
              setRenamingCourse(null);
              if (selected === renamingCourse) setSelected(newName);
              // onUpdate is called by RenameCourseModal itself with the patched courseSubjects
            }}
            onCourseSubjectsUpdate={onUpdate}
          />
        )}
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
  const [msPreset, setMsPreset] = useState("");

  // Applying a preset auto-fills date/shift/marks for the current course from
  // that config's session/mark data — everything stays editable afterward.
  const applyMsPreset = (presetId) => {
    setMsPreset(presetId);
    if (!presetId) return;
    const cfg = EXAM_CONFIG_PRESETS.find(p => p.id === presetId);
    if (!cfg) return;
    if (cfg.examDate) setMsStartDate(cfg.examDate);
    if (cfg.sessions?.[0]?.time) {
      const t = cfg.sessions[0].time.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (t) {
        let [, hh, mm, ap] = t;
        hh = parseInt(hh, 10);
        if (/pm/i.test(ap) && hh !== 12) hh += 12;
        if (/am/i.test(ap) && hh === 12) hh = 0;
        setMsTime(`${String(hh).padStart(2, "0")}:${mm}`);
      }
      setMsShift(cfg.sessions[0].label || "Morning");
    }
    const subs = cfg.courseSubjects?.[msCourse] || courseSubjects[msCourse] || [];
    const maxMap = cfg.courseMaxMarks?.[msCourse] || {};
    setMsRows(subs.map((subject) => ({ subject, date: "", marks: maxMap[subject] || getSubjectMax(msCourse, subject) })));
  };

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
    if (msPreset) {
      const cfg = EXAM_CONFIG_PRESETS.find(p => p.id === msPreset);
      if (cfg) {
        const subs = cfg.courseSubjects?.[msCourse] || courseSubjects[msCourse] || [];
        const maxMap = cfg.courseMaxMarks?.[msCourse] || {};
        setMsRows(subs.map((subject) => ({ subject, date: "", marks: maxMap[subject] || getSubjectMax(msCourse, subject) })));
        return;
      }
    }
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
      parsed.push({ exam_type_id, course, subject, exam_date, time: r[col("time")]?.toString().trim() || "09:00", shift: r[col("shift")]?.toString().trim() || "Morning", room: r[col("room")]?.toString().trim() || "", total_marks: Number(r[col("marks")]) || getSubjectMax(course, subject) });
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

  // Edits Time / Shift / Room (and, less commonly, marks) on an EXISTING
  // schedule entry — needed because results are sometimes imported before
  // these are known (e.g. the Result Sheet importer lets Time/Room stay
  // blank), and the only prior way to fix that was delete + recreate, which
  // loses the schedule entry's exam_id and would orphan any marks already
  // recorded against it. This updates in place instead.
  const handleUpdateRow = async (id, patch) => {
    const { error } = await supabase.from("exam_schedule").update(patch).eq("id", id);
    if (error) { alert(error.message); return; }
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
                <select value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value, total_marks: e.target.value ? getSubjectMax(p.course, e.target.value) : p.total_marks }))} style={css.input}>
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
            onDelete={handleDelete} onUpdate={handleUpdateRow} selectable={false} />
        </div>
      )}

      {/* MULTI-SUBJECT */}
      {mode === "multi" && (
        <div style={{ display: isMobile ? "flex" : "grid", flexDirection: "column", gridTemplateColumns: "1fr 1fr", gap: isMobile ? 14 : 20 }}>
          <div style={css.card}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#1e293b", marginBottom: 4 }}>📋 Multi-Subject Entry</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 14 }}>Add all subjects for a course at once.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 }}>
              <div><FieldLabel>Preset (optional)</FieldLabel>
                <select value={msPreset} onChange={e => applyMsPreset(e.target.value)} style={css.input}>
                  <option value="">— No preset, fill manually —</option>
                  {EXAM_CONFIG_PRESETS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select></div>
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
              <div><FieldLabel>Total Marks <span style={{ fontWeight:400, color:"#9CA3AF", textTransform:"none" }}>(applied to all selected courses)</span></FieldLabel>
                <input type="number" value={bkMarks} onChange={e => setBkMarks(e.target.value)} style={css.input} />
                {bkSubject && bkCourses.size > 0 && (
                  <div style={{ fontSize:11, color:"#9CA3AF", marginTop:4 }}>
                    Config suggests: {[...bkCourses].map(c => `${c} ${getSubjectMax(c, bkSubject)}`).join(" · ")}
                  </div>
                )}
              </div>
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
            onDelete={handleDelete} onUpdate={handleUpdateRow} selectable={false} />
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
            onDelete={handleDelete} onUpdate={handleUpdateRow} selectable={true} selected={dupIds}
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
          onDelete={handleDelete} onUpdate={handleUpdateRow} selectable={false} />
      )}
    </div>
  );
}

// ─── Shared Schedule Table ────────────────────────────────────────────────────
function ScheduleTable({ schedule, examTypes, courses, filterCourse, setFilterCourse, filterExamType, setFilterExamType, onDelete, onUpdate, selectable, selected, onToggle, onSelectAll, onDeselectAll }) {
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [savingEdit, setSavingEdit] = useState(false);

  const startEdit = (s) => {
    setEditingId(s.id);
    setEditForm({ time: s.time || "", shift: s.shift || "", room: s.room || "" });
  };
  const cancelEdit = () => { setEditingId(null); setEditForm({}); };
  const saveEdit = async (id) => {
    setSavingEdit(true);
    await onUpdate?.(id, { time: editForm.time || null, shift: editForm.shift || null, room: editForm.room || null });
    setSavingEdit(false);
    setEditingId(null);
    setEditForm({});
  };

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
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 600 }}>
            <thead><tr style={{ background: "#F8FAFC", borderBottom: "2px solid #E5E7EB" }}>
              {selectable && <th style={{ padding: "10px 12px", width: 36 }}></th>}
              {["Date","Course","Exam Type","Subject","Shift","Time","Marks","Room",""].map(h => (
                <th key={h} style={{ padding: "10px 10px", textAlign: "left", fontWeight: 700, color: "#374151", fontSize: 11 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {schedule.map((s, i) => {
                const missingForAdmitCard = !s.time || !s.room;
                return (
                <tr key={s.id} style={{ background: selectable && selected && selected.has(s.id) ? "#EFF6FF" : i % 2 ? "#F9FAFB" : "white", borderBottom: "1px solid #F1F5F9" }}>
                  {selectable && <td style={{ padding: "9px 12px", textAlign: "center" }}><input type="checkbox" checked={selected && selected.has(s.id) || false} onChange={() => onToggle(s.id)} /></td>}
                  <td style={{ padding: "9px 10px", fontWeight: 600 }}>{s.exam_date}</td>
                  <td style={{ padding: "9px 10px" }}><span style={{ background: "#E1F5EE", color: "#0F6E56", padding: "2px 7px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{s.course || "—"}</span></td>
                  <td style={{ padding: "9px 10px" }}>{examTypes.find(e => e.id === s.exam_type_id)?.name || s.exam_type_id}</td>
                  <td style={{ padding: "9px 10px" }}>{s.subject}</td>
                  {editingId === s.id ? (
                    <>
                      <td style={{ padding: "6px 8px" }}><input value={editForm.shift} onChange={e => setEditForm(p => ({ ...p, shift: e.target.value }))} placeholder="Morning" style={{ ...css.input, width: 90, fontSize: 12 }} /></td>
                      <td style={{ padding: "6px 8px" }}><input value={editForm.time} onChange={e => setEditForm(p => ({ ...p, time: e.target.value }))} placeholder="09:00 AM" style={{ ...css.input, width: 90, fontSize: 12 }} /></td>
                      <td style={{ padding: "9px 10px", color: "#64748b" }}>{s.total_marks}</td>
                      <td style={{ padding: "6px 8px" }}><input value={editForm.room} onChange={e => setEditForm(p => ({ ...p, room: e.target.value }))} placeholder="Hall 2" style={{ ...css.input, width: 90, fontSize: 12 }} /></td>
                      <td style={{ padding: "9px 10px" }}>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button onClick={() => saveEdit(s.id)} disabled={savingEdit} style={{ ...css.btn, padding: "4px 10px", background: "#1a3c2e", color: "white", fontSize: 11 }}>{savingEdit ? "…" : "✓"}</button>
                          <button onClick={cancelEdit} style={{ ...css.btn, padding: "4px 8px", background: "#F3F4F6", color: "#374151", fontSize: 11 }}>✕</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: "9px 10px", color: "#64748b" }}>{s.shift || "Morning"}</td>
                      <td style={{ padding: "9px 10px", color: missingForAdmitCard ? "#DC2626" : "#64748b", fontWeight: missingForAdmitCard ? 700 : 400 }}>{s.time || "-- (not set)"}</td>
                      <td style={{ padding: "9px 10px", color: "#64748b" }}>{s.total_marks}</td>
                      <td style={{ padding: "9px 10px", color: missingForAdmitCard ? "#DC2626" : "#64748b", fontWeight: missingForAdmitCard ? 700 : 400 }}>{s.room || "-- (not set)"}</td>
                      <td style={{ padding: "9px 10px" }}>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button onClick={() => startEdit(s)} title={missingForAdmitCard ? "Add time/room for Admit Cards" : "Edit time/shift/room"}
                            style={{ ...css.btn, padding: "4px 8px", background: missingForAdmitCard ? "#FFFBEB" : "#EFF6FF", color: missingForAdmitCard ? "#92400E" : "#1D4ED8", border: `1px solid ${missingForAdmitCard ? "#FDE68A" : "#BFDBFE"}`, fontSize: 11 }}>✏️</button>
                          <button onClick={() => onDelete(s.id)} style={{ ...css.btn, padding: "4px 8px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", fontSize: 11 }}>✕</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
                );
              })}
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
    const matchCourse = filterCourse==="ALL" || (s.class_name||"").toUpperCase()===filterCourse.toUpperCase();
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || String(s.gcc_no).includes(search);
    return matchCourse && matchSearch;
  }).sort((a,b) => {
    const aA = globalAssigned.has(a.id), bA = globalAssigned.has(b.id);
    if (aA !== bA) return aA ? 1 : -1;
    return a.name.localeCompare(b.name);
  });

  const autoAssign = () => {
    const unassigned = students.filter(s => (filterCourse==="ALL" || (s.class_name||"").toUpperCase()===filterCourse.toUpperCase()) && !globalAssigned.has(s.id));
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
.btn-print{background:#0f2d5e;color:white;}.btn-close{background:#e5e7eb;color:#374151;}
.page-break{page-break-after:always;height:0;overflow:hidden;}
.card{width:720px;margin:0 auto 24px;background:#F0F4FF;border-radius:3px;box-shadow:0 12px 48px rgba(0,0,0,0.22),0 0 0 1px #B8C9E8;position:relative;overflow:hidden;}
.top-strip{height:5px;background:linear-gradient(90deg,#0f2d5e 0%,#1a4d8a 30%,#B8860B 60%,#f0c040 80%,#1a4d8a 100%);}
.header{background:linear-gradient(150deg,#071a3e 0%,#0f2d5e 45%,#133a7a 100%);padding:22px 32px 18px;display:flex;align-items:center;gap:16px;}
.logo-ring{width:64px;height:64px;border-radius:50%;border:2px solid #D4A017;background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.logo-text{font-family:'Playfair Display',serif;font-size:15px;font-weight:700;color:white;}
.header-center{flex:1;text-align:center;}
.eyebrow{font-size:9px;letter-spacing:4px;text-transform:uppercase;color:#cbd5e1;margin-bottom:5px;font-weight:600;}
.inst-name{font-family:'Playfair Display',serif;font-size:20px;font-weight:600;color:white;margin-bottom:3px;}
.inst-addr{font-size:11px;color:#cbd5e1;}
.doc-badge{text-align:center;flex-shrink:0;}
.doc-badge-title{font-family:'Playfair Display',serif;font-size:14px;font-weight:700;color:white;letter-spacing:2px;line-height:1.2;}
.doc-badge-sub{font-size:10px;color:#cbd5e1;margin-top:3px;font-weight:600;}
.exam-result-bar{background:#0f2d5e;padding:10px 24px;display:flex;justify-content:space-between;align-items:center;}
.exam-info{display:flex;gap:20px;flex-wrap:wrap;}
.exam-info-item{display:flex;flex-direction:column;}
.exam-info-label{font-size:8px;letter-spacing:2px;text-transform:uppercase;color:#e0e7ff;margin-bottom:2px;font-weight:700;}
.exam-info-value{font-size:13px;font-weight:600;color:#ffffff;}
.result-pill-bar{display:flex;align-items:center;gap:8px;}
.student-section{padding:14px 24px 10px;}
.section-title{font-family:'Cormorant Garamond',serif;font-size:13px;font-weight:600;color:#0f2d5e;letter-spacing:2px;text-transform:uppercase;margin-bottom:10px;}
.student-table{width:100%;border-collapse:collapse;font-size:13px;}
.student-table td{padding:7px 10px;border:1px solid #BFDBFE;}
.student-table .lbl{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#1a4d8a;font-weight:600;background:#EFF6FF;width:120px;}
.student-table .val{font-weight:600;color:#0A1628;}
.student-table .val.big{font-family:'Playfair Display',serif;font-size:16px;color:#0f2d5e;}
.score-grid{display:grid;grid-template-columns:repeat(5,1fr);background:#0f2d5e;margin:0 16px 0;border-radius:6px;overflow:hidden;}
.score-cell{text-align:center;padding:12px 8px;border-right:1px solid rgba(255,255,255,0.2);}
.score-cell:last-child{border-right:none;}
.score-lbl{font-size:8px;letter-spacing:2px;text-transform:uppercase;color:#e0e7ff;margin-bottom:4px;font-weight:700;}
.score-val{font-family:'Playfair Display',serif;font-size:22px;font-weight:600;color:#ffffff;line-height:1;}
.score-val.gold{color:#fbbf24;}
.score-sub{font-size:10px;color:#d0d9ff;margin-top:2px;font-weight:500;}
.marks-section{padding:14px 24px;}
.marks-table{width:100%;border-collapse:collapse;font-size:12.5px;border:1px solid #BFDBFE;border-radius:6px;overflow:hidden;}
.marks-table thead tr{background:#DBEAFE;}
.marks-table thead th{padding:8px 10px;text-align:center;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#1e3a6e;font-weight:700;border-bottom:2px solid #93C5FD;}
.marks-table tbody td{padding:9px 10px;text-align:center;border-bottom:1px solid #EFF6FF;}
.marks-table tfoot tr{background:#DBEAFE;}
.marks-table tfoot td{padding:10px;border-top:2px solid #93C5FD;text-align:center;font-weight:700;}
.remark-box{margin:0 24px 14px;padding:12px 16px;background:white;border:1px solid #BFDBFE;border-left:4px solid #1a4d8a;border-radius:4px;}
.remark-label{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#1a4d8a;font-weight:700;margin-bottom:5px;}
.remark-text{font-family:'Cormorant Garamond',serif;font-size:14px;font-style:italic;color:#1e3a6e;line-height:1.6;}
.sig-section{display:flex;align-items:flex-end;justify-content:space-between;padding:14px 24px 18px;background:white;border-top:1px solid #BFDBFE;gap:16px;}
.sig-block{text-align:center;flex:1;}
.sig-space{height:40px;}
.sig-label{border-top:1.5px solid #1C1A16;padding-top:5px;font-size:9px;letter-spacing:1.5px;text-transform:uppercase;color:#1e3a6e;font-weight:600;margin:0 10px;}
.seal-block{flex:0 0 90px;display:flex;flex-direction:column;align-items:center;}
.seal{width:90px;height:90px;display:flex;align-items:center;justify-content:center;}
.seal img{width:90px;height:90px;object-fit:contain;}
.footer-strip{background:linear-gradient(90deg,#071a3e,#0f2d5e,#071a3e);padding:8px 32px;}
.footer-text{font-size:10px;color:#cbd5e1;text-align:center;font-weight:500;}
.bottom-strip{height:4px;background:linear-gradient(90deg,#1a4d8a,#60A5FA,#1a4d8a);}
@media print{body{background:white;padding:0;}.no-print{display:none!important;}.card{box-shadow:none;border-radius:0;width:100%;margin:0;}}
`;

// ─── buildReportCardHTML ──────────────────────────────────────────────────────
function buildReportCardHTML(st, subjects, subjectMaxMap, courseMax, marksMap, course, allStudents, examName, examDate, institute, remarkText) {
  const getTotal = sid => subjects.reduce((s,sub)=>s+(Number(marksMap[`${sid}-${sub}`])||0),0);
  const total = getTotal(st.id);
  const pct = courseMax ? (total / courseMax) * 100 : 0;
  const grade = getGrade(pct);
  const passed = pct >= 40;
  const gradeColors = {"A+":"#fbbf24","A":"#fbbf24","B+":"#e0e7ff","B":"#e0e7ff","C":"#f87171","D":"#fb923c","F":"#fca5a5"};
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
    const subMax=(subjectMaxMap && subjectMaxMap[s]) || 100;
    const subPct=Math.round((m/subMax)*100);
    const subPassed=subPct>=40;
    const barColor=subPct>=80?"#1a56db":subPct>=60?"#1B4F8A":subPct>=40?"#BA7517":"#C0392B";
    const gradeLbl=subPct>=90?"A+":subPct>=80?"A":subPct>=70?"B+":subPct>=60?"B":subPct>=50?"C":subPct>=40?"D":"F";
    return `<tr>
      <td style="text-align:left;font-weight:600;color:#2D3748">${idx+1}. ${s}</td>
      <td>${subMax}</td>
      <td style="font-family:'EB Garamond',serif;font-size:14px;font-weight:700;color:#0A1628">${m}</td>
      <td><div style="display:flex;align-items:center;gap:5px;"><div style="flex:1;height:6px;background:#E2E8F0;border-radius:3px;overflow:hidden;"><div style="width:${subPct}%;height:100%;background:${barColor};border-radius:3px;"></div></div><span style="font-size:10px;font-weight:700;color:${barColor};min-width:32px">${subPct}%</span></div></td>
      <td><span style="display:inline-block;padding:1px 8px;border-radius:2px;font-size:11px;font-weight:700;color:${barColor};border:1px solid ${barColor};background:${barColor}18">${gradeLbl}</span></td>
      <td><span style="font-size:10px;font-weight:700;color:${subPassed?"#1a56db":"#C0392B"}">${subPassed?"✓ PASS":"✗ FAIL"}</span></td>
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
        <span style="font-size:10px;font-weight:700;letter-spacing:1px;padding:3px 8px;border-radius:2px;background:${passed?"#EFF6FF":"#FCEBEB"};color:${passed?"#1a56db":"#C0392B"};border:1px solid ${passed?"#BFDBFE":"#FECACA"}">${passed?"PASS":"FAIL"}</span>
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
          <td><span style="font-size:11px;font-weight:700;color:${passed?"#1a56db":"#C0392B"}">${passed?"✓ PASS":"✗ FAIL"}</span></td>
        </tr></tfoot>
      </table>
    </div>
    ${remarkBlock}
    <div class="sig-section">
      <div class="sig-block"><div class="sig-space"></div><div class="sig-label">Student's Signature</div></div>
      <div class="seal-block"><div class="seal"><img src="data:image/png;base64,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" alt="GNSI 10 Years Seal" /></div></div>
      <div class="sig-block"><div class="sig-space"></div><div class="sig-label">Class Teacher</div></div>
      <div class="sig-block"><div class="sig-space"></div><div class="sig-label">Head of Institute</div></div>
    </div>
    <div class="footer-strip"><div class="footer-text">${institute.name||"GNSI"} · ${institute.address||"Khangabok, Manipur"} · ${examName} · Academic Year ${institute.academicYear||"2025-2026"}</div></div>
    <div class="bottom-strip"></div>
  </div>`;
}

// ─── REPORT CARD ITEM ─────────────────────────────────────────────────────────
// ─── Shared "is this student absent for this exam sitting?" check ─────────────
// Same convention as ExamAbsentFinder / MarkEntry's toggleAbsent: absence is
// recorded as marks_obtained = 0 in every subject. A student with NO rows at
// all (not yet entered) is NOT counted as absent — only fully-zero rows are.
function isStudentAbsentForExam(studentId, subjects, marksMap) {
  if (!subjects.length) return false;
  const values = subjects.map(sub => marksMap[`${studentId}-${sub}`]);
  const hasAnyRow = values.some(v => v !== undefined && v !== null && v !== "");
  if (!hasAnyRow) return false;
  return values.every(v => Number(v) === 0);
}

function ReportCardItem({ st, subjects, subjectMaxMap, courseMax, marks, examType, examDate, examName, institute, allStudents, course }) {
  const { remark, setRemark, save: saveRemark, saving: savingRemark, saved: savedRemark } = useRemarks(st.id, examType, examDate);
  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[`${sid}-${sub}`]) || 0), 0);
  const total = getTotal(st.id);
  const pct = courseMax ? (total / courseMax) * 100 : 0;
  const grade = getGrade(pct);

  const printReport = () => {
    const sortedStudents = [...allStudents].map(s => ({ ...s, total: getTotal(s.id) })).sort((a, b) => b.total - a.total);
    let rank = 1, prev = null;
    for (let i = 0; i < sortedStudents.length; i++) {
      if (i === 0) { rank = 1; prev = sortedStudents[i].total; } else if (sortedStudents[i].total !== prev) { rank++; prev = sortedStudents[i].total; }
      if (sortedStudents[i].id === st.id) break;
    }
    const html = buildReportCardHTML(st, subjects, subjectMaxMap, courseMax, marks, course, allStudents, examName, examDate, institute, remark);
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
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course.toUpperCase()
  );
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate] = useState("");
  const [marks, setMarks] = useState({});
  const [dates, setDates] = useState([]);
  const [datesLoaded, setDatesLoaded] = useState(false); // distinguishes "still checking" from "confirmed zero"
  const [excludeAbsent, setExcludeAbsent] = useState(true); // hide absent students from report cards + ranking
  // ── Real exam config, sourced live from exam_schedule for this exact course + exam type —
  // NOT the static courseSubjects/COURSE_MAX_MARKS config, which can drift out of sync with
  // whatever was actually scheduled and marked. This is what makes Report Cards "integrate
  // with exam config": subject list + max marks always mirror Mark Entry / Schedule exactly.
  const [scheduledSubjects, setScheduledSubjects] = useState([]); // [{ subject, total_marks }]

  useEffect(() => {
    if (!examType) return;
    setDatesLoaded(false);
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]); else setExamDate("");
      setDatesLoaded(true);
    });
  }, [examType]);

  useEffect(() => {
    if (!examType || !course) { setScheduledSubjects([]); return; }
    supabase.from("exam_schedule").select("id, subject, total_marks").eq("exam_type_id", examType).eq("course", course).order("exam_date").then(({ data }) => {
      setScheduledSubjects(data || []);
    });
  }, [examType, course]);

  const subjects = scheduledSubjects.length ? scheduledSubjects.map(s => s.subject) : (courseSubjects[course] || []);
  const subjectMaxMap = {};
  scheduledSubjects.forEach(s => { subjectMaxMap[s.subject] = s.total_marks; });
  const courseMax = scheduledSubjects.length
    ? scheduledSubjects.reduce((sum, s) => sum + (Number(s.total_marks) || 0), 0)
    : getCourseMax(course);

  useEffect(() => {
    if (!examType || !examDate) return;
    const ids = courseStudents.map(s => s.id);
    // Resolve marks via exam_schedule (exam_id -> subject) instead of trusting the
    // raw `subject` text column on exam_marks directly — that column can be null/stale
    // on older rows or out of sync with the current schedule, which silently dropped
    // marks here even though Mark Entry (which joins via exam_id) could see them fine.
    supabase.from("exam_schedule").select("id, subject").eq("exam_type_id", examType).eq("course", course).then(({ data: sched }) => {
        const examIdToSubject = {};
        (sched || []).forEach(s => { examIdToSubject[s.id] = s.subject; });
        const scopedExamIds = (sched || []).map(s => s.id);
        if (!scopedExamIds.length) { setMarks({}); return; }
        supabase.from("exam_marks").select("student_id, exam_id, marks_obtained").eq("exam_type_id", examType).in("student_id", ids.length ? ids : ["__none__"]).in("exam_id", scopedExamIds).then(({ data }) => {
          const map = {};
          (data || []).forEach(r => {
            const sub = examIdToSubject[r.exam_id];
            if (sub) map[`${r.student_id}-${sub}`] = r.marks_obtained;
          });
          setMarks(map);
        });
    });
  }, [examType, course, examDate]);

  const examName = examTypes.find(e => e.id === examType)?.name || "Examination";
  const absentCount = courseStudents.filter(s => isStudentAbsentForExam(s.id, subjects, marks)).length;
  const visibleStudents = excludeAbsent ? courseStudents.filter(s => !isStudentAbsentForExam(s.id, subjects, marks)) : courseStudents;
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
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 160 }}>
            {!dates.length && <option value="">{datesLoaded ? "— No marks recorded —" : "Checking…"}</option>}
            {dates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, cursor: "pointer", background: "white", padding: "8px 14px", borderRadius: 8, border: "1px solid #E5E7EB" }}>
          <input type="checkbox" checked={excludeAbsent} onChange={e => setExcludeAbsent(e.target.checked)} />
          Exclude absent students {absentCount > 0 && <span style={{ color: "#DC2626", fontWeight: 700 }}>({absentCount})</span>}
        </label>
      </div>
      {datesLoaded && !dates.length && (
        <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "12px 16px", marginBottom: 14, fontSize: 12.5, color: "#92400E", lineHeight: 1.6 }}>
          ⚠️ No marks have been recorded yet under the exam type "<b>{examName}</b>". If you already imported or entered marks under what looks like this same exam type, there may be a <b>duplicate exam type with an identical name</b> pointing at a different record —
          check <b>Setup → Exam Types</b> for duplicates (it will flag them and show which copy actually has marks), or confirm the Exam Type used in Mark Entry matches this exact one.
        </div>
      )}
      {!scheduledSubjects.length && examType && course && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "12px 16px", marginBottom: 14, fontSize: 12.5, color: "#991B1B", lineHeight: 1.6 }}>
          ⚠️ No exam is scheduled for <b>{course}</b> under "<b>{examName}</b>" — totals and max marks below are falling back to the static Course Subjects config, which may not match what was actually entered. Set up the schedule in <b>Exams → Schedule</b> for accurate report cards.
        </div>
      )}
      {excludeAbsent && absentCount > 0 && (
        <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#6B7280" }}>
          🚫 {absentCount} absent student{absentCount === 1 ? "" : "s"} hidden from this view and excluded from ranking. Uncheck "Exclude absent students" above to show them.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
        {visibleStudents.map(st => (
          <ReportCardItem key={st.id} st={st} subjects={subjects} subjectMaxMap={subjectMaxMap} courseMax={courseMax} marks={marks} examType={examType} examDate={examDate} examName={examName} institute={institute} allStudents={visibleStudents} course={course} />
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
  const [rcExcludeAbsent, setRcExcludeAbsent] = useState(true); // hide absent students from bulk report cards + ranking

  const [acCourse, setAcCourse]       = useState(courses[0] || "");
  const [acExamType, setAcExamType]   = useState(examTypes[0]?.id || "");
  const [acSearch, setAcSearch]       = useState("");
  const [acSortBy, setAcSortBy]       = useState("name");
  const [acProgress, setAcProgress]   = useState(null);

  // ── Real exam config for bulk report cards, sourced from the schedule prop
  // (already fetched live by the parent) instead of the static courseSubjects /
  // COURSE_MAX_MARKS config — keeps bulk-printed cards in sync with what was
  // actually scheduled and marked, same as the single Report Cards tab.
  const rcScheduledRows = schedule.filter(s => s.exam_type_id === rcExamType && (!s.course || s.course.toUpperCase() === rcCourse.toUpperCase()));
  const rcSubjects = rcScheduledRows.length ? rcScheduledRows.map(s => s.subject) : (courseSubjects[rcCourse] || []);
  const rcSubjectMaxMap = {};
  rcScheduledRows.forEach(s => { rcSubjectMaxMap[s.subject] = s.total_marks; });
  const rcCourseMax = rcScheduledRows.length
    ? rcScheduledRows.reduce((sum, s) => sum + (Number(s.total_marks) || 0), 0)
    : getCourseMax(rcCourse);
  const rcStudents = students.filter(s => (s.class_name||"").trim().toUpperCase()===rcCourse.trim().toUpperCase());
  const acStudents = students.filter(s => (s.class_name||"").trim().toUpperCase()===acCourse.trim().toUpperCase());
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
    // Resolve via exam_schedule (exam_id -> subject), scoped to THIS course's
    // schedule only — see the matching fix in ReportCards/Analytics/Rankings/
    // etc. for the full explanation. Querying exam_marks by exam_type_id alone
    // (previously with a `|| r.subject` fallback) let a dual-appearing
    // student's OTHER course's mark silently overwrite this course's mark
    // whenever the raw subject text happened to collide (e.g. "Mathematics I"
    // in both ACHIEVER and Combined Navodaya), inflating totals past 100%.
    supabase.from("exam_schedule").select("id, subject").eq("exam_type_id", rcExamType).eq("course", rcCourse).then(({ data: sched }) => {
      const examIdToSubject = {};
      (sched || []).forEach(s => { examIdToSubject[s.id] = s.subject; });
      const scopedExamIds = (sched || []).map(s => s.id);
      if (!scopedExamIds.length) { setRcMarks({}); setRcLoading(false); return; }
      supabase.from("exam_marks").select("student_id, exam_id, marks_obtained").eq("exam_type_id", rcExamType).in("student_id", ids.length?ids:["__none__"]).in("exam_id", scopedExamIds).then(({ data }) => {
        const map = {};
        (data||[]).forEach(r=>{
          const sub = examIdToSubject[r.exam_id];
          if (sub) map[`${r.student_id}-${sub}`]=r.marks_obtained;
        });
        setRcMarks(map); setRcLoading(false);
      });
    });
  }, [rcExamType, rcCourse, rcExamDate]);

  useEffect(() => {
    if (!rcExamType || !rcExamDate || !rcStudents.length) return;
    const ids = rcStudents.map(s=>s.id);
    supabase.from("exam_remarks").select("*").eq("exam_type_id", rcExamType).eq("exam_date", rcExamDate).in("student_id", ids).then(({ data }) => {
      const map = {}; (data||[]).forEach(r=>{ map[r.student_id]=r.remark; });
      setRcRemarks(map);
    });
  }, [rcExamType, rcExamDate, rcCourse]);

  const getTotal = (sid) => rcSubjects.reduce((s,sub)=>s+(Number(rcMarks[`${sid}-${sub}`])||0),0);
  const getPct   = (sid) => rcCourseMax ? (getTotal(sid) / rcCourseMax) * 100 : 0;

  const absentRcCount = rcStudents.filter(s => isStudentAbsentForExam(s.id, rcSubjects, rcMarks)).length;
  const rankingPoolRcStudents = rcExcludeAbsent ? rcStudents.filter(s => !isStudentAbsentForExam(s.id, rcSubjects, rcMarks)) : rcStudents;

  const sortedRcStudents = [...rankingPoolRcStudents].sort((a,b)=>{
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
      cards.push(buildReportCardHTML(st, rcSubjects, rcSubjectMaxMap, rcCourseMax, rcMarks, rcCourse, rankingPoolRcStudents, examTypes.find(e=>e.id===rcExamType)?.name||"Examination", rcExamDate, institute, remark));
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
                <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, cursor:"pointer" }}>
                  <input type="checkbox" checked={rcExcludeAbsent} onChange={e=>setRcExcludeAbsent(e.target.checked)} />
                  Exclude absent students {absentRcCount > 0 && <span style={{ color:"#DC2626", fontWeight:700 }}>({absentRcCount})</span>}
                </label>
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
              <StatPill label="Passed"  value={rankingPoolRcStudents.filter(s=>getPct(s.id)>=40).length} color="#0F6E56" />
              <StatPill label="Failed"  value={rankingPoolRcStudents.filter(s=>getPct(s.id)<40 && getTotal(s.id)>0).length} color="#A32D2D" />
              {absentRcCount > 0 && <StatPill label="Absent" value={absentRcCount} color="#DC2626" />}
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
                        <td style={{ padding:"8px 10px", textAlign:"center", fontWeight:700 }}>{total}/{rcCourseMax}</td>
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
function AdmitCardsTab({ courseSubjects, examTypes, students, institute, schedule, onScheduleChange }) {
  const isMobile = useMobile();
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [search, setSearch] = useState("");
  const [populating, setPopulating] = useState(false);
  const [populateError, setPopulateError] = useState("");

  // Dropout students don't get admit cards for an upcoming sitting — same
  // convention as MarkEntry above. Their past admit cards/history aren't
  // affected since those were already generated/printed at the time.
  const courseStudents = students.filter(s =>
    (s.class_name || "").toUpperCase() === course.toUpperCase() && s.status !== "Dropout"
  );
  const filtered = courseStudents.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) || String(s.gcc_no).includes(search)
  );
  const examTypeName = examTypes.find(e => e.id === examType)?.name || "Examination";
  const examSchedule = schedule.filter(s =>
    s.exam_type_id === examType && (!s.course || s.course.toUpperCase() === course.toUpperCase())
  );

  // Finds an Exam Config preset whose name matches the selected Exam Type (case-insensitive,
  // ignoring extra whitespace) — the same matching a person would do by eye when picking the
  // right preset in Schedule's Multi-Subject mode. Null if no such preset exists.
  const matchingPreset = EXAM_CONFIG_PRESETS.find(p =>
    p.name.trim().toLowerCase() === examTypeName.trim().toLowerCase()
  );

  // Auto-populates exam_schedule for the CURRENT course from the matching Exam Config preset,
  // using today's date as a placeholder — same subjects/marks a person would get by using the
  // Schedule tab's preset dropdown, just triggered directly from this warning banner.
  const autoPopulateFromConfig = async () => {
    if (!matchingPreset) return;
    setPopulating(true);
    setPopulateError("");
    const subs = matchingPreset.courseSubjects?.[course] || courseSubjects[course] || [];
    const maxMap = matchingPreset.courseMaxMarks?.[course] || {};
    if (!subs.length) {
      setPopulateError(`The preset "${matchingPreset.name}" has no subjects defined for ${course}. Add them in Exam Config first.`);
      setPopulating(false);
      return;
    }
    const today = new Date().toISOString().split("T")[0];
    const targetDate = matchingPreset.examDate || today;
    // Guard against duplicates: only insert subject+date combinations that don't
    // already exist for this course + exam type (e.g. from a prior Auto-Generate
    // Timetable run or an earlier click of this same button).
    const { data: existing } = await supabase.from("exam_schedule").select("subject, exam_date").eq("exam_type_id", examType).eq("course", course);
    const existingKey = new Set((existing || []).map(s => `${(s.subject || "").toLowerCase()}|${s.exam_date}`));
    const rows = subs
      .filter(subject => !existingKey.has(`${subject.toLowerCase()}|${targetDate}`))
      .map(subject => ({
        exam_type_id: examType,
        course,
        subject,
        exam_date: targetDate,
        time: "09:00",
        shift: matchingPreset.sessions?.[0]?.label || "Morning",
        room: "",
        total_marks: maxMap[subject] || getSubjectMax(course, subject),
      }));
    if (!rows.length) {
      setPopulating(false);
      setPopulateError(`${course} already has schedule entries for ${targetDate} — nothing new to add.`);
      return;
    }
    const { error } = await supabase.from("exam_schedule").insert(rows);
    setPopulating(false);
    if (error) { setPopulateError(error.message); return; }
    onScheduleChange?.();
  };

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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <span>
              ⚠️ No schedule entries for this exam type
              {matchingPreset ? <> — matches Exam Config preset "<b>{matchingPreset.name}</b>".</> : <>. Go to <b>Schedule</b> tab and add entries.</>}
            </span>
            {matchingPreset && (
              <button onClick={autoPopulateFromConfig} disabled={populating}
                style={{ ...css.btn, padding: "7px 14px", fontSize: 12, background: populating ? "#93C5FD" : "#1a3c2e", color: "white", whiteSpace: "nowrap" }}>
                {populating ? "⏳ Populating…" : `⚡ Auto-populate for ${course}`}
              </button>
            )}
          </div>
          {populateError && <div style={{ marginTop: 8, color: "#991B1B", fontSize: 12 }}>{populateError}</div>}
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
  {
    id: "monthly_test_july_2026",
    name: "1st Monthly Test July 2026",
    description: "OMR-based — per official notice GNSI/EXAM/2026–27/008",
    examDate: "2026-07-15",
    examMode: "OMR",
    sessions: [
      { label: "Morning Shift – I",  time: "10:15 AM – 12:45 PM" },
      { label: "Evening Shift – II", time: "01:30 PM – 03:30 PM" },
    ],
    courseSubjects: {
      ACHIEVER:  ["Mathematics I","Mathematics II","Reasoning","English Grammar & Vocabulary","General Knowledge & Science"],
      CHAMPION:  ["Mathematics I","Mathematics II","Reasoning","English Grammar & Vocabulary","General Knowledge & Science"],
      LEADER:    ["Mathematics I","Mathematics II","Reasoning","English Grammar & Vocabulary","General Knowledge & Science"],
      LAKSHYA:   ["Mathematics I","Mathematics II","Mental ability","Meitei Mayek / English Passage","EVS"],
      UMEED:     ["Mathematics I","Mathematics II","Mental ability","Meitei Mayek / English Passage","EVS"],
      ELITE:     ["Mathematics","Reasoning","English Grammar & Vocabulary","Meitei Mayek","Science"],
      PRIME:     ["Mathematics","Reasoning","English Grammar & Vocabulary","Meitei Mayek","Science"],
    },
    courseMaxMarks: {
      ACHIEVER:  {"Mathematics I":75,"Mathematics II":75,"Reasoning":50,"English Grammar & Vocabulary":50,"General Knowledge & Science":50},
      CHAMPION:  {"Mathematics I":75,"Mathematics II":75,"Reasoning":50,"English Grammar & Vocabulary":50,"General Knowledge & Science":50},
      LEADER:    {"Mathematics I":75,"Mathematics II":75,"Reasoning":50,"English Grammar & Vocabulary":50,"General Knowledge & Science":50},
      LAKSHYA:   {"Mathematics I":20,"Mathematics II":20,"Mental ability":20,"Meitei Mayek / English Passage":20,"EVS":20},
      UMEED:     {"Mathematics I":20,"Mathematics II":20,"Mental ability":20,"Meitei Mayek / English Passage":20,"EVS":20},
      ELITE:     {"Mathematics":30,"Reasoning":20,"English Grammar & Vocabulary":20,"Meitei Mayek":15,"Science":15},
      PRIME:     {"Mathematics":30,"Reasoning":20,"English Grammar & Vocabulary":20,"Meitei Mayek":15,"Science":15},
    },
  },
];

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
const COURSE_TARGET_TOTAL = {
  ACHIEVER: 300, CHAMPION: 300, LEADER: 300,
  // everything else defaults to 100
};

function ExamFormatBuilder({ courseSubjects, onSave, onCancel, editingConfig, prefillName, onCourseSubjectsUpdate }) {
  const isMobile = useMobile();
  const allCourses = Object.keys(courseSubjects);
  const isEdit = !!editingConfig;
  const getTarget = (course) => COURSE_TARGET_TOTAL[course] || 100;

  // Normalizes any stored date string to YYYY-MM-DD (what <input type="date"> requires).
  // Handles ISO ("2026-07-15"), DD-MM-YYYY / DD/MM/YYYY ("10-07-2026"), and garbage —
  // anything unparseable falls back to "" instead of corrupting the picker.
  const toISODate = (v) => {
    if (!v) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
    const m = String(v).match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (m) {
      const [, dd, mm, yyyy] = m;
      return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
    }
    return "";
  };

  // Wizard steps
  const [step, setStep] = useState(1);
  const TOTAL_STEPS = 5;

  // Step 1
  const [name, setName]         = useState(editingConfig?.name || prefillName || "");
  const [description, setDesc]  = useState(editingConfig?.description || "");
  const [examDate, setExamDate] = useState(toISODate(editingConfig?.examDate));
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
  const [renamingCourse, setRenamingCourse] = useState(null); // course currently being renamed (global, cascading)

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

  // Renames a subject in place — keeps its position in the list and carries
  // its mark value across to the new name (a plain remove+add would lose the
  // mark and reorder it to the bottom of the list).
  const renameSubject = (course, oldSub, newSub) => {
    const trimmed = newSub.trim();
    if (!trimmed || trimmed === oldSub) return;
    setCourseData(prev => {
      const existing = prev[course] || { subjects: [], marks: {} };
      if (existing.subjects.includes(trimmed)) return prev; // name collision — leave unchanged
      const subjects = existing.subjects.map(s => s === oldSub ? trimmed : s);
      const marks = { ...existing.marks };
      if (oldSub in marks) { marks[trimmed] = marks[oldSub]; delete marks[oldSub]; }
      return { ...prev, [course]: { ...existing, subjects, marks } };
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
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. 3rd Monthly Test — August 2026" style={{ ...css.input, fontSize:15 }} />
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
              style={{ padding:"14px 16px", borderRadius:12, border: sel?"2px solid #1a3c2e":"1.5px solid #E5E7EB", background: sel?"#E1F5EE":"#F9FAFB", cursor:"pointer", transition:"all .15s", position:"relative" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ fontWeight:700, fontSize:14, color: sel?"#0F6E56":"#374151" }}>{c}</div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <button onClick={e => { e.stopPropagation(); setRenamingCourse(c); }} title={`Rename "${c}" everywhere (students, schedule, marks, configs)`}
                    style={{ ...css.btn, padding:"2px 6px", fontSize:11, background: sel?"#0F6E56":"#E5E7EB", color: sel?"white":"#6B7280", border:"none" }}>
                    ✏️
                  </button>
                  <div style={{ width:20, height:20, borderRadius:"50%", background: sel?"#0F6E56":"#E5E7EB", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"white", fontWeight:700, flexShrink:0 }}>
                    {sel ? "✓" : ""}
                  </div>
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
                <div key={c} style={{ display:"flex", alignItems:"stretch", gap:0 }}>
                  <button onClick={() => setActiveCourse(c)}
                    style={{ ...css.btn, padding:"8px 12px", textAlign:"left", fontSize:12, flex:1,
                      background: activeCourse===c?"#1a3c2e":"#F9FAFB",
                      color: activeCourse===c?"white":"#374151",
                      border: activeCourse===c?"none": ok?"1px solid #BBF7D0":"1px solid #E5E7EB",
                      borderRadius: "8px 0 0 8px",
                      display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
                    <span>{c}</span>
                    <span style={{ fontSize:10, opacity:0.75 }}>{ok ? `${cd.subjects.length}s` : "⚠️"}</span>
                  </button>
                  <button onClick={() => setRenamingCourse(c)} title={`Rename "${c}" everywhere (students, schedule, marks, configs)`}
                    style={{ ...css.btn, padding:"8px 8px", fontSize:11, borderRadius:"0 8px 8px 0",
                      background: activeCourse===c?"#14532d":"#E5E7EB",
                      color: activeCourse===c?"white":"#6B7280",
                      border: activeCourse===c?"none":"1px solid #E5E7EB", borderLeft:"none" }}>
                    ✏️
                  </button>
                </div>
              );
            })}
          </div>
        </div>


        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <div style={{ fontWeight:700, fontSize:15, color:"#1a3c2e" }}>{activeCourse}</div>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <span style={{ fontSize:11, color: total===getTarget(activeCourse)?"#0F6E56":total>getTarget(activeCourse)?"#DC2626":"#9CA3AF", fontWeight:700 }}>
                Total: {total} / {getTarget(activeCourse)}
              </span>
              <button onClick={() => autoSplitMarks(activeCourse, getTarget(activeCourse))}
                style={{ ...css.btn, padding:"4px 10px", fontSize:11, background:"#EFF6FF", color:"#1D4ED8", border:"1px solid #BFDBFE" }}>
                ⚡ Auto-split {getTarget(activeCourse)}
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
            <button onClick={() => addSubjectWithMark()}
              style={{ ...css.btn, background:"#1a3c2e", color:"white", whiteSpace:"nowrap" }}>+ Add</button>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {d.subjects.map((sub, i) => (
              <div key={sub} style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", background: i%2?"#F9FAFB":"white", borderRadius:8, border:"1px solid #F1F5F9" }}>
                <div style={{ fontSize:10, color:"#CBD5E1", fontWeight:700, width:18, flexShrink:0 }}>{i+1}</div>
                {editingSub === `name-${activeCourse}-${sub}` ? (
                  <input type="text" autoFocus defaultValue={sub}
                    style={{ flex:1, fontSize:13, fontWeight:600, color:"#1e293b", padding:"4px 8px", borderRadius:6, border:"1.5px solid #6366f1", outline:"none" }}
                    onBlur={e => { renameSubject(activeCourse, sub, e.target.value); setEditingSub(null); }}
                    onKeyDown={e => {
                      if (e.key === "Enter") { renameSubject(activeCourse, sub, e.target.value); setEditingSub(null); }
                      if (e.key === "Escape") setEditingSub(null);
                    }} />
                ) : (
                  <div onClick={() => setEditingSub(`name-${activeCourse}-${sub}`)} title="Click to edit subject name"
                    style={{ flex:1, fontSize:13, fontWeight:600, color:"#1e293b", cursor:"pointer", padding:"4px 8px", borderRadius:6 }}>
                    {sub}
                  </div>
                )}
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
            const target = getTarget(c);
            return (
              <div key={c} style={{ background:"white", borderRadius:10, border: ok?"1px solid #BBF7D0":"1px solid #FECACA", padding:"12px 14px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                  <div style={{ fontWeight:700, color:"#1a3c2e", fontSize:13 }}>{c}</div>
                  <span style={{ fontSize:11, padding:"2px 8px", borderRadius:999, background: total===target?"#E1F5EE":total>target?"#FCEBEB":"#FFFBEB", color: total===target?"#0F6E56":total>target?"#DC2626":"#92400E", fontWeight:700 }}>
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

  const stepFns = [Step1, Step2, Step3, Step4, Step5];
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
        {stepFns[step - 1]()}
        <NavButtons />
      </div>

      {renamingCourse && (
        <RenameCourseModal
          courseSubjects={courseSubjects}
          oldName={renamingCourse}
          onClose={() => setRenamingCourse(null)}
          onDone={(newName) => {
            // Keep this in-progress wizard consistent with the global rename:
            // swap the key in local courseData/selectedCourses/activeCourse
            // so the rest of the wizard doesn't silently point at a name
            // that no longer exists anywhere else in the app. Rendered here,
            // once, at the top level — Step2 and Step3 both trigger renames
            // via the same renamingCourse state, but only one step is
            // mounted at a time, so the modal itself must live outside them.
            setCourseData(prev => {
              if (!(renamingCourse in prev)) return prev;
              const next = { ...prev };
              next[newName] = next[renamingCourse];
              delete next[renamingCourse];
              return next;
            });
            setSelectedCourses(prev => {
              if (!prev.has(renamingCourse)) return prev;
              const next = new Set(prev);
              next.delete(renamingCourse);
              next.add(newName);
              return next;
            });
            if (activeCourse === renamingCourse) setActiveCourse(newName);
            setRenamingCourse(null);
          }}
          onCourseSubjectsUpdate={onCourseSubjectsUpdate}
        />
      )}

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
function ExamConfigManager({ courseSubjects, onUpdate, activeConfigId, onConfigSwitch, prefillName, onPrefillConsumed }) {
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

  // Arrived here via "Set up schedule" from Exam Types — open the builder straight
  // away with the exam type's name already filled in, instead of a blank form.
  const [builderPrefillName, setBuilderPrefillName] = useState("");
  useEffect(() => {
    if (!prefillName) return;
    setEditingConfig(null);
    setBuilderPrefillName(prefillName);
    setShowBuilder(true);
    onPrefillConsumed?.();
  }, [prefillName]);

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
      onCancel={() => { setShowBuilder(false); setEditingConfig(null); setBuilderPrefillName(""); }}
      editingConfig={editingConfig}
      prefillName={builderPrefillName}
      onCourseSubjectsUpdate={onUpdate}
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
  const [examConfigPrefillName, setExamConfigPrefillName] = useState("");
  const [students, setStudents]     = useState([]);
  const [examTypes, setExamTypes]   = useState([]);
  const [courseSubjects, setCourseSubjects] = useState(DEFAULT_COURSE_SUBJECTS);
  const [schedule, setSchedule]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [institute, setInstitute]   = useState(INSTITUTE_DEFAULT);
  const [activeConfigId, setActiveConfigId] = useState("default");
  const [markEntryRefreshKey, setMarkEntryRefreshKey] = useState(0);
  const [lastCSVImportContext, setLastCSVImportContext] = useState(null);
  const [syncVersion, setSyncVersion] = useState(0); // Trigger for global sync
 
  const refetchSchedule = useCallback(async () => {
    const { data } = await supabase.from('exam_schedule').select('*').order('exam_date');
    setSchedule(data || []);
    setSyncVersion(v => v + 1); // Notify all tabs to sync
  }, []);

  /**
   * Central sync handler: whenever courseSubjects changes,
   * notify Schedule and ExamConfig to re-validate their data
   */
  const handleCourseSubjectsUpdate = useCallback((newSubjects) => {
    setCourseSubjects(newSubjects);
    setSyncVersion(v => v + 1);
  }, []);
 
  // Exams.jsx historically treats `class_name` as "the batch" (Achiever / Champion /
  // Umeed / etc). At one point the Students module wrote the real value to a
  // column called `batch` instead of `class_name`, so this normalizer preferred
  // `batch` over `class_name` to paper over that mismatch.
  //
  // That preference became actively harmful once the Result Sheet importer /
  // rename tool / cleanup tools were built: those all treat `class_name` as
  // the single source of truth for a student's real batch, and use `batch` as
  // a secondary DISPLAY field that can carry an extra " — SECTION" suffix
  // (e.g. "ACHIEVER — ENG"). With `s.batch || s.class_name`, any student whose
  // `batch` got corrupted with that suffix had their CORRECT class_name
  // silently overwritten in memory on every single page load — invisible in
  // the database (where class_name was always right), but very visible in the
  // app, where it undercounted batches like ACHIEVER by dozens of students.
  // class_name is now the trusted field; batch is never used to override it.
  //
  // Combined Course fix: students on the "Combined Course" track have no real
  // batch split, so Students.jsx/Attendance.jsx store their `batch` as the
  // placeholder "—" (an em-dash). But every exam function here (ReportCards,
  // BulkReports, AdmitCardsTab, MarkEntry, ...) filters students by comparing
  // class_name against a key in `courseSubjects`, and the only Combined Course
  // key that exists there is the full descriptive string
  // "Combined Navodaya Course (Sainik Appearing Group)" — which "—" never
  // equals. That mismatch is exactly why Combined Course had no student list
  // anywhere in Exams: every course/batch filter silently returned zero
  // students for it. Translating the placeholder here, in the one shared
  // normalizer, fixes every exam function at once without touching each one.
  const COMBINED_COURSE_BATCH_LABEL = "Combined Navodaya Course (Sainik Appearing Group)";
  const normalizeStudent = (s) => {
    const batch = (s.course === "Combined Course" && (!s.class_name || s.class_name === "—"))
      ? COMBINED_COURSE_BATCH_LABEL
      : (s.class_name || s.batch || "");
    return { ...s, class_name: batch };
  };

  // ── Secondary batches: a student can appear under a SECOND batch (e.g. a
  // Sainik-batch student who is ALSO appearing for the Combined Navodaya exam)
  // without duplicating their row or their GCC No. — students.class_name can
  // only hold one value, so this is tracked in a small separate table and
  // merged in below as read-only "phantom" entries that share the real
  // student's id (so marks/seat assignments/etc. still write against the
  // correct, single real student). Only exam-facing tabs get the expanded
  // list; the Students roster itself (studentsmgr) shows one row per person.
  const [secondaryBatchMap, setSecondaryBatchMap] = useState({}); // { studentId: [batch, ...] }

  const expandWithSecondaryBatches = useCallback((list, map) => {
    const extra = [];
    list.forEach(s => {
      (map[s.id] || []).forEach(batch => {
        if (batch && batch !== s.class_name) {
          extra.push({ ...s, class_name: batch, _isSecondaryBatchView: true, _primaryClassName: s.class_name });
        }
      });
    });
    return extra.length ? [...list, ...extra] : list;
  }, []);

  const refetchSecondaryBatches = useCallback(async () => {
    const { data } = await supabase.from("student_secondary_batches").select("student_id, batch");
    const map = {};
    (data || []).forEach(r => { (map[r.student_id] = map[r.student_id] || []).push(r.batch); });
    setSecondaryBatchMap(map);
  }, []);

  // MarkEntry receives the EXPANDED list (examStudents, computed below) so
  // dual-appearing students show up correctly, but its own "add new student
  // inline" flow spreads that same list and calls onStudentsChange with it. If
  // that were wired straight to setStudents, every phantom secondary-batch
  // entry would get written back into the real students state as if it were a
  // distinct student, permanently duplicating every dual-appearing student.
  // This wrapper only takes newly-added real students (ones with no
  // _isSecondaryBatchView marker that aren't already in `students`) and merges
  // just those into the real list, dropping any phantom entries that were
  // only ever an artifact of the expansion.
  //
  // IMPORTANT: this hook must stay ABOVE the `if (loading) return` below —
  // hooks can never be called conditionally or after an early return, since
  // React tracks hooks by call order across renders. Placing this after the
  // early return caused "Rendered more hooks than during the previous
  // render" (React error #310) once `loading` flipped to false.
  const handleMarkEntryStudentsChange = useCallback((updatedExpandedList) => {
    setStudents(prev => {
      const existingIds = new Set(prev.map(s => s.id));
      const genuinelyNew = updatedExpandedList.filter(s => !s._isSecondaryBatchView && !existingIds.has(s.id));
      return genuinelyNew.length ? [...prev, ...genuinelyNew].sort((a, b) => (a.name || "").localeCompare(b.name || "")) : prev;
    });
  }, []);

  useEffect(() => {
    ensureLibs();

    const loadData = async () => {
      const [{ data: sts }, { data: types }, { data: csSetting }, { data: sched }, { data: instSetting }, { data: secBatches }] =
        await Promise.all([
          supabase.from("students").select("id,name,class_name,course,batch,admission_no,gcc_no,status").order("name"),
          supabase.from("exam_types").select("*").order("created_at"),
          supabase.from("system_settings").select("value").eq("key", "course_subjects").single(),
          supabase.from("exam_schedule").select("*").order("exam_date"),
          supabase.from("system_settings").select("value").eq("key", "exam_institute_config").single(),
          supabase.from("student_secondary_batches").select("student_id, batch"),
        ]);

      setStudents((sts || []).map(normalizeStudent));
      const secMap = {};
      (secBatches || []).forEach(r => { (secMap[r.student_id] = secMap[r.student_id] || []).push(r.batch); });
      setSecondaryBatchMap(secMap);
      setExamTypes(types && types.length ? types : [{ id: "default", name: "1st Monthly Test" }]);
      if (csSetting?.value) {
        try {
          const saved = JSON.parse(csSetting.value);
          // Merge in any batches present in DEFAULT_COURSE_SUBJECTS but missing from the
          // saved config — e.g. a newly-added batch shouldn't silently disappear just
          // because the DB row predates it. Existing saved batches are never overwritten.
          const merged = { ...DEFAULT_COURSE_SUBJECTS, ...saved };
          setCourseSubjects(merged);
        } catch (_) {}
      }
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

    // ── Realtime: keep secondary-batch tags in sync too ──
    const secondaryBatchChannel = supabase
      .channel('exams:secondary-batches-sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'student_secondary_batches' },
        () => { refetchSecondaryBatches(); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(studentsChannel);
      supabase.removeChannel(secondaryBatchChannel);
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
 
  // Expanded student list for every EXAM-FACING tab: a student with a
  // secondary batch appears once under their real batch (unchanged) and once
  // more under the secondary batch, sharing the same real id so marks/seat
  // assignments always write against the correct single student row. The raw
  // Students roster (studentsmgr) intentionally uses `students` directly, not
  // this — one row per real person there, with the secondary batch shown as a
  // tag rather than a duplicate row.
  const examStudents = expandWithSecondaryBatches(students, secondaryBatchMap);
 
  const handleCSVImportDone = (_marksMap, course, examTypeId, examDate) => {
    // ExamCSVImport already upserted the marks to Supabase internally, and tells us
    // exactly which course / exam type / date it used. Capture that so the remounted
    // MarkEntry opens on the right combination instead of always defaulting to the
    // first course / first exam type / today's date.
    if (course || examTypeId || examDate) setLastCSVImportContext({ course, examTypeId, examDate });
    setMarkEntryRefreshKey(k => k + 1);
    setTab("entry");
  };
 
  // ── Section map ────────────────────────────────────────────────────────────
  const sectionMap = {
    dashboard:      () => <ExamDashboard courseSubjects={courseSubjects} examTypes={examTypes} students={examStudents} institute={institute} schedule={schedule} />,
    toppers:        () => <ToppersCertificate courseSubjects={courseSubjects} examTypes={examTypes} students={examStudents} institute={institute} />,
    entry:          () => <MarkEntry key={markEntryRefreshKey} courseSubjects={courseSubjects} examTypes={examTypes} students={examStudents} currentUser={currentUser} perms={perms} onStudentsChange={handleMarkEntryStudentsChange} initialCourse={lastCSVImportContext?.course} initialExamType={lastCSVImportContext?.examTypeId} initialExamDate={lastCSVImportContext?.examDate} />,
 
    // ── NEW: smart CSV import tab ──────────────────────────────────────────
    csvimport: () => (
      <ExamCSVImport
        courseSubjects={courseSubjects}
        students={examStudents}
        examTypes={examTypes}
        examDate={new Date().toISOString().split("T")[0]}
        examTypeId={examTypes[0]?.id || ""}
        isMobile={window.innerWidth < 768}
        onImportDone={handleCSVImportDone}
      />
    ),
    // ──────────────────────────────────────────────────────────────────────
 
    marks:          () => <MarksGrid courseSubjects={courseSubjects} examTypes={examTypes} students={examStudents} />,
    analytics:      () => <Analytics courseSubjects={courseSubjects} examTypes={examTypes} students={examStudents} />,
    rankings:       () => <Rankings courseSubjects={courseSubjects} examTypes={examTypes} students={examStudents} />,
    merit:          () => <MeritList courseSubjects={courseSubjects} examTypes={examTypes} students={examStudents} />,
    reportcard:     () => <ReportCards courseSubjects={courseSubjects} examTypes={examTypes} students={examStudents} institute={institute} />,
    // ── SYNCED: Schedule now uses syncVersion and refetchSchedule ──
    schedule:       () => <Schedule key={syncVersion} courseSubjects={courseSubjects} examTypes={examTypes} onScheduleChange={refetchSchedule} />,
    seatplan:       () => <SeatArrangement courseSubjects={courseSubjects} examTypes={examTypes} students={examStudents} institute={institute} schedule={schedule} />,
    studentsmgr:    () => <StudentsTab courseSubjects={courseSubjects} students={students} examTypes={examTypes} onStudentsChange={setStudents} currentUser={currentUser} perms={perms} secondaryBatchMap={secondaryBatchMap} onSecondaryBatchesChange={refetchSecondaryBatches} />,
    // ── SYNCED: CourseSubjectsManager uses centralized handler ──
    coursesubjects: () => <CourseSubjectsManager key={syncVersion} courseSubjects={courseSubjects} onUpdate={handleCourseSubjectsUpdate} />,
    examtypes:      () => <ExamTypesManager examTypes={examTypes} onUpdate={setExamTypes} onSetupSchedule={(name) => { setExamConfigPrefillName(name); setTab("examconfig"); }} courseSubjects={courseSubjects} onScheduleChange={refetchSchedule} />,
    // ── SYNCED: ExamConfigManager notifies on config switch ──
    examconfig:     () => <ExamConfigManager key={syncVersion} courseSubjects={courseSubjects} onUpdate={handleCourseSubjectsUpdate} activeConfigId={activeConfigId} onConfigSwitch={(cfg) => { setActiveConfigId(cfg.id); window.__gnsiCourseMaxMarks = cfg.courseMaxMarks || {}; setSyncVersion(v => v + 1); }} prefillName={examConfigPrefillName} onPrefillConsumed={() => setExamConfigPrefillName("")} />,
    settings:       () => <ExamSettings institute={institute} onUpdateInstitute={setInstitute} />,
    progress:       () => <ProgressTab courseSubjects={courseSubjects} examTypes={examTypes} students={examStudents} />,
    compare:        () => <CompareTab courseSubjects={courseSubjects} examTypes={examTypes} students={examStudents} />,
    admitcard:      () => <AdmitCardsTab courseSubjects={courseSubjects} examTypes={examTypes} students={examStudents} institute={institute} schedule={schedule} onScheduleChange={refetchSchedule} />,
    bulkreport:     () => <BulkReports courseSubjects={courseSubjects} examTypes={examTypes} students={examStudents} institute={institute} schedule={schedule} />,
  };
 
  const activeTabInfo = TAB_GROUPS.flatMap(g => g.tabs).find(t => t.id === tab);
  const isMobile = window.innerWidth < 768;
 
  return (
    <div className="exams-root" style={{ minHeight: "100vh", background: "#F7F6F1", fontFamily: "'DM Sans','Inter',sans-serif" }}>
      <ExamHubHeader institute={institute} students={students} courses={courses} examTypes={examTypes} currentUser={currentUser} />
      <TabNav active={tab} onSelect={setTab} perms={perms} isAdmin={currentUser?.role === 'Admin'} currentUser={currentUser} />
      <div style={{ padding: isMobile ? "14px 12px" : "24px 28px", maxWidth: 1400 }}>
        <div style={{ marginBottom: 18 }}>
          <h2 style={{ margin: 0, fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 400, color: "#1C1A16" }}>
            {activeTabInfo?.icon} {activeTabInfo?.label}
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#9CA3AF" }}>{activeTabInfo?.tip}</p>
        </div>
        {sectionMap[tab]?.()}
      </div>
    </div>
  );
}