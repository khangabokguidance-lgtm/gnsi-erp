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
import { sysOr } from "./systemSettings";
import { getActiveStudents } from './studentQueries'
import { receiptDocument, receiptSheet, receiptHeader, openReceiptWindow, esc as rcEscape } from './premiumReceipt';
import { ADMIT_CARD_CSS, generateAdmitCardHTML, openAdmitCardPrintWindow } from './admitCardTemplate'
import ToppersCertificate from './ToppersCertificate'
import ExamDashboard from './ExamDashboard'
import MockTestAnalyzer from './MockTestAnalyzer'
import ResponsiveTables from './ResponsiveTables'
import { ExamHomeMobile, ExamTopBar, ExamBottomBar } from './ExamsMobile'
import ExamIcon from './examIcons'
import { PremiumStyles, PremiumHero, PremiumTabs, PIcon } from './premiumUI'
import './examsTheme.css'
import './mobile.css';
import ExamCSVImport from './lib/ExamCSVImport';
import { isAdminRole } from './roles'

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
// Hoisted to module level so effects/memos need not list them as dependencies.
const COMPARE_COLORS = ["#1e3a6e","#185FA5","#a7771f","#d97706"];
const SUFFIX_RE = /\s+—\s+([A-Za-z]+)$/;
// Maps the extracted suffix to the batch it actually should have been
// recorded as a secondary batch for. Confirmed exact names: "ENG" → the
// English-medium Combined Navodaya batch, "MM" → the Manipuri-medium one.
const SUFFIX_TO_SECONDARY_BATCH = {
  ENG: "Combined Navodaya Course(ENG)",
  MM: "Combined Navodaya Course (MM)",
};

const DEFAULT_COURSE_SUBJECTS = {
  ACHIEVER:  ["English Grammar", "Vocabulary", "General Knowledge", "Mathematics -I", "Mathematics - II", "Reasoning", "Science"],
  ELITE:     ["English Grammar", "Science", "Mathematics", "Reasoning", "Meitei Mayek"],
  PRIME:     ["English Grammar", "Science", "Mathematics", "Reasoning", "Meitei Mayek"],
  LAKSHYA:   ["Grammar", "Mental", "Mathematics", "Meitei Mayek"],
  // Split to match the live saved config's actual keys ("LAKSHYA - A" /
  // "LAKSHYA - B"), which StudentDB's "Lakshya A"/"Lakshya B" batches
  // translate to (see STUDENTDB_BATCH_TO_EXAM_KEY). Only used if the saved
  // system_settings row is ever missing/reset — the live config already has
  // its own entries for these, which always take priority.
  "LAKSHYA - A": ["Grammar", "Mental", "Mathematics", "Meitei Mayek"],
  "LAKSHYA - B": ["Grammar", "Mental", "Mathematics", "Meitei Mayek"],
  UMEED:     ["Grammar & Vocabulary", "Mental", "Mathematics", "Meitei Mayek"],
  CHAMPION:  ["Vocabulary", "General Knowledge", "Mathematics-II", "Mathematics - I", "Reasoning", "Grammar", "Science"],
  LEADER:    ["Vocabulary", "Grammar", "General Knowledge", "Mathematics -I", "Mathematics - II", "Reasoning", "Science"],
  // Corrected again: the batch's actual exam papers have ONE Mathematics
  // paper, not two — confirmed from the real COMBINED_NAVODAYA_ENG/MAN result
  // sheets (both have a single "MATHEMATICS" column). The prior "Mathematics
  // -I" / "Mathematics - II" split was wrong despite its own comment claiming
  // it was confirmed from result sheets — it wasn't.
  "Combined Navodaya Course (Sainik Appearing Group)": ["Mathematics", "Mental Ability", "Passage", "EVS"],
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
  // Split to match the live saved courseSubjects keys ("LAKSHYA - A" /
  // "LAKSHYA - B") — see STUDENTDB_BATCH_TO_EXAM_KEY. Kept the old
  // unsplit "LAKSHYA" too in case any legacy record still uses it.
  Navodaya:         ["LAKSHYA - A", "LAKSHYA - B", "LAKSHYA", "UMEED"],
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

// ─── Shared course-batch matcher (handles "Combined Navodaya ... ENG/MAN") ──
// ResultSheetImport (see its own comment where it sets `section`) writes the
// ENG/MAN medium-of-instruction tag only as a suffix on the unused `batch`
// column "purely for display" — class_name is never split by section, so
// every Combined Navodaya student keeps one shared class_name no matter
// which section they sat. A plain class_name === courseKey check therefore
// always returns 0 students for any courseSubjects key that encodes a
// section (e.g. "COMBINED NAVODAY ENG", "COMBINED NAVODAYA MAN"), even
// though those students genuinely exist. Every exam-facing filter that
// matches students to a courseSubjects key should go through this function
// instead of a bare equality check, so this fallback only needs to live in
// one place.
function matchesCourseBatch(s, courseKey) {
  const cn = (s.class_name || "").trim().toUpperCase();
  const target = (courseKey || "").trim().toUpperCase();
  if (cn === target) return true; // exact match — normal, unaffected case

  // Does the target course key carry a trailing section tag (ENG / MAN / MM /
  // HIN / MEI) on top of a base batch name? e.g.
  // "COMBINED NAVODAY ENG"  -> base "COMBINED NAVODAY",  section "ENG"
  // "COMBINED NAVODAYA MAN" -> base "COMBINED NAVODAYA", section "MAN"
  const sectionMatch = target.match(/^(.*?)[\s(]*\b(ENG|MAN|MM|HIN|MEI)\b\)?\s*$/);
  if (!sectionMatch) return false;
  const base = sectionMatch[1].trim();
  let section = sectionMatch[2];
  if (section === "MAN") section = "MM"; // "Man"(ipuri) and "MM" are the same medium tag elsewhere in this file

  // The student's class_name must at least belong to the same Combined
  // Navodaya family as the target's base name (loose match, since the full
  // stored class_name is "COMBINED NAVODAYA COURSE (SAINIK APPEARING GROUP)").
  const sameFamily = cn.startsWith(base) || base.startsWith(cn) || cn.includes("COMBINED NAVODAY");
  if (!sameFamily) return false;

  // Signal 1: raw batch suffix, e.g. "...GROUP) MAN" or "...GROUP)-ENG"
  const rawBatch = (s.batch || "").toUpperCase();
  if (rawBatch.includes(section) || (section === "MM" && rawBatch.includes("MAN"))) return true;

  // Signal 2: secondary-batch tag, e.g. class_name got set to
  // "Combined Navodaya Course(ENG)" / "Combined Navodaya Course (MM)" for
  // the phantom expanded entry (see expandWithSecondaryBatches) — check for
  // the section token inside class_name too, guarding against the token
  // already being part of the base name.
  const classNameHasSectionTag = cn.includes(`(${section})`) || cn.includes(` ${section})`) || cn.includes(section);
  if (!base.includes(section) && classNameHasSectionTag) {
    return true;
  }

  return false;
}

// ─── Canonical secondary-batch spelling normalizer ───────────────────────────
// Secondary batches should only ever be tagged as one of the two canonical
// strings the rest of this file uses everywhere else (see
// SUFFIX_TO_SECONDARY_BATCH in BatchSuffixCleanupTool and the ENG/MM consts in
// DuplicateSectionTagResolver / ReportCards / etc.): "Combined Navodaya
// Course(ENG)" and "Combined Navodaya Course (MM)". Older/other import paths
// have left stray variant spellings behind (e.g. "Combined Navoday ENG",
// missing the "a" and using a space instead of the exact "(ENG)" format) that
// mean the same thing but don't string-match the canonical tag. This function
// maps any recognized variant to its canonical form so DISPLAY (stats cards,
// dropdowns) can merge them into one entry without needing the underlying
// student_secondary_batches rows to be fixed first — see
// SecondaryBatchSpellingCleanupTool below for actually fixing the rows.
const CANONICAL_ENG_TAG = "Combined Navodaya Course(ENG)";
const CANONICAL_MM_TAG = "Combined Navodaya Course (MM)";
function normalizeSecondaryBatchSpelling(raw) {
  const v = (raw || "").trim();
  const upper = v.toUpperCase();
  if (v === CANONICAL_ENG_TAG || v === CANONICAL_MM_TAG) return v;
  if (upper.includes("COMBINED NAVODAY") && /\bENG\b/.test(upper)) return CANONICAL_ENG_TAG;
  if (upper.includes("COMBINED NAVODAY") && /\b(MM|MAN|MANIPURI)\b/.test(upper)) return CANONICAL_MM_TAG;
  return v; // unrelated/unrecognized batch value — leave untouched
}

// ─── Shared: list of distinct secondary-batch values from secondaryBatchMap ──
// ({ studentId: [batchName, ...] }) — used anywhere a tab needs to let staff
// pick a secondary batch (e.g. "Combined Navodaya Course(ENG)") directly,
// since these values are NOT courseSubjects keys and so never show up in a
// normal CoursePicker. See CourseSubjectsManager's "junk key" comment for why
// they shouldn't be added there either. Variant spellings (see
// normalizeSecondaryBatchSpelling above) are merged into their canonical form
// here, so the list/counts staff see are correct even before the underlying
// data is cleaned up.
function listSecondaryBatches(secondaryBatchMap) {
  const all = Object.values(secondaryBatchMap || {}).flat().filter(Boolean).map(normalizeSecondaryBatchSpelling);
  return [...new Set(all)].sort();
}


// StudentDB (Attendance.jsx → TabStudentDB) writes students.batch using its
// own COURSE_STRUCTURE spelling: "Achiever", "Leader", "Champion", "Umeed",
// "Lakshya A", "Lakshya B", "Prime", "Elite", "—" (Combined Course). The
// exam side's courseSubjects (a saved system_settings row, editable in
// Exams → Course/Subjects) determines the actual live keys — confirmed here
// to be the all-caps spelling with Lakshya kept SPLIT ("LAKSHYA - A",
// "LAKSHYA - B"), not merged. Every exam function keys courseSubjects/
// COURSE_MAX_MARKS/TRACK_BATCHES by that spelling, so this map translates
// StudentDB's batch value into it. Without this translation every
// courseSubjects[batch] lookup here silently returned [] for every
// StudentDB-entered student.
const STUDENTDB_BATCH_TO_EXAM_KEY = {
  ACHIEVER: "ACHIEVER",
  LEADER: "LEADER",
  CHAMPION: "CHAMPION",
  UMEED: "UMEED",
  "LAKSHYA A": "LAKSHYA - A",
  "LAKSHYA B": "LAKSHYA - B",
  PRIME: "PRIME",
  ELITE: "ELITE",
};
function batchToCourseSubjectsKey(batch) {
  const b = (batch || "").trim().toUpperCase();
  if (!b || b === "—") return COMBINED_COURSE_BATCH_LABEL_CONST;
  return STUDENTDB_BATCH_TO_EXAM_KEY[b] || batch || "";
}
// Combined Course has no batch split — StudentDB stores "—" as its placeholder.
const COMBINED_COURSE_BATCH_LABEL_CONST = "Combined Navodaya Course (Sainik Appearing Group)";

// ─── Max marks per subject per course (all total to 100) ─────────────────────
const COURSE_MAX_MARKS = {
  ACHIEVER:  { "English Grammar": 10, "Vocabulary": 10, "General Knowledge": 10, "Mathematics -I": 20, "Mathematics - II": 20, "Reasoning": 20, "Science": 10 },
  ELITE:     { "English Grammar": 20, "Science": 15, "Mathematics": 30, "Reasoning": 20, "Meitei Mayek": 15 },
  PRIME:     { "English Grammar": 20, "Science": 15, "Mathematics": 30, "Reasoning": 20, "Meitei Mayek": 15 },
  LAKSHYA:   { "Grammar": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  // "LAKSHYA - A"/"LAKSHYA - B" are the live, split batch keys StudentDB's
  // "Lakshya A"/"Lakshya B" batches translate to (see
  // STUDENTDB_BATCH_TO_EXAM_KEY) — this file's courseSubjects/TRACK_BATCHES
  // already use the split spelling, but this max-marks table still only had
  // the old unsplit "LAKSHYA" key, so any Lakshya-A/B student fell through
  // to getSubjectMax's hardcoded 100-per-subject default instead of the
  // correct split. Using the same values as unsplit LAKSHYA as a sane
  // fallback — this only applies where the live saved exam config (edited
  // via Exams → Course/Subjects) doesn't already override it.
  "LAKSHYA - A": { "Grammar": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  "LAKSHYA - B": { "Grammar": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  UMEED:     { "Grammar & Vocabulary": 20, "Mental": 30, "Mathematics": 30, "Meitei Mayek": 20 },
  CHAMPION:  { "Vocabulary": 10, "General Knowledge": 10, "Mathematics-II": 20, "Mathematics - I": 20, "Reasoning": 20, "Grammar": 10, "Science": 10 },
  LEADER:    { "Vocabulary": 10, "Grammar": 10, "General Knowledge": 10, "Mathematics -I": 20, "Mathematics - II": 20, "Reasoning": 20, "Science": 10 },
  // Matches actual result sheets: 4 subjects (Mathematics is one paper, not
  // split into I/II), each out of 25, totaling 100 — confirmed from the max
  // observed marks in COMBINED_NAVODAYA_ENG/MAN_RESULT_OK.xls (25.00 each).
  "Combined Navodaya Course (Sainik Appearing Group)": { "Mathematics": 25, "Mental Ability": 25, "Passage": 25, "EVS": 25 },
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
    bg = "#eef2f9"; color = "#4338CA"; label = "Manual";
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
    bg = "#eef2f9"; color = "#4338CA"; label = "Manual";
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
  { min: 60, label: "B",  color: "#1e3a6e", bg: "#e4ebf6", gpa: 2.5 },
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
  if (isAdminRole(role))   return { canEdit:true,  canDelete:true,  canImport:true,  canPrint:true  }
  if (role === 'Manager')  return { canEdit:true,  canDelete:false, canImport:true,  canPrint:true  }
  if (role === 'Accounts' || role === 'Accountant') return { canEdit:true,  canDelete:false, canImport:true,  canPrint:true  }
  return                          { canEdit:true,  canDelete:false, canImport:false, canPrint:true  }
}

const TAB_GROUPS = [
  {
  groupLabel: "Entry", color: "#1e3a6e",
  tabs: [
    { id: "entry",     icon: "✏️", label: "Mark Entry",  tip: "Enter & save marks" },
    { id: "csvimport", icon: "📂", label: "CSV Import",   tip: "Smart CSV / Excel import" },
  ]
},
  {
    groupLabel: "Results", color: "#b8923a",
    tabs: [
      { id: "marks",     icon: "📊", label: "Marks Grid",  tip: "View all marks" },
      { id: "analytics", icon: "📉", label: "Analytics",   tip: "Charts & class analysis" },
      { id: "rankings",  icon: "🏆", label: "Rankings",    tip: "Top performers" },
      { id: "progress",  icon: "🎓", label: "Progress",    tip: "Per-student progress" },
      { id: "compare",   icon: "⚖️",  label: "Compare",    tip: "Side-by-side comparison" },
      { id: "merit",     icon: "📜", label: "Merit List",  tip: "Generate merit lists" },
      { id: "dashboard", icon: "🏠", label: "Dashboard",   tip: "Exam HUB overview" },
      { id: "mockanalyzer", icon: "🧠", label: "Mock Analyzer", tip: "Advanced student, subject & batch analysis of mock tests — upload Excel, save records, print reports" }
    ]
  },
  {
    groupLabel: "Documents", color: "#0f7a4c",
    tabs: [
      { id: "admitcard",  icon: "🪪",  label: "Admit Cards",  tip: "Generate admit cards" },
      { id: "reportcard", icon: "📋", label: "Report Cards", tip: "Print report cards" },
      { id: "bulkreport", icon: "📦", label: "Bulk Reports", tip: "Batch report generation" },
      { id: "toppers",    icon: "🏅", label: "Certificates", tip: "Print topper certificates" }
    ]
  },
  {
    groupLabel: "Schedule", color: "#9a5b00",
    tabs: [
      { id: "schedule",  icon: "📅", label: "Schedule",         tip: "Exam timetable" },
      { id: "seatplan",  icon: "🪑", label: "Seat Arrangement", tip: "Assign seats & rooms" },
    ]
  },
  {
    groupLabel: "Setup", color: "#5d6b82",
    tabs: [
      { id: "studentsmgr",    icon: "👤", label: "Students",        tip: "Add & manage students" },
      { id: "coursesubjects", icon: "📚", label: "Course Subjects",  tip: "Subjects per course/batch" },
      { id: "examtypes",      icon: "⚙️",  label: "Exam Types",      tip: "Configure exam types" },
      { id: "examconfig", icon: "🗂️", label: "Exam Config", tip: "Switch exam mark schemes" },
      { id: "settings",       icon: "🔧", label: "Settings",        tip: "Grading & institute config" },
    ]
  },
];

// Defaults follow System Settings (Basic Info / Appearance); an exam's own
// saved institute config (exam_institute_config) still overrides them.
const INSTITUTE_DEFAULT = {
  get name() { return sysOr("school_name", "Guidance Navodaya & Sainik Institute"); },
  get address() { return sysOr("school_address", "Khangabok Sorok Wangma Thoubal, Manipur -795138"); },
  tagline: "A Premier Institute for Navodaya, Sainik & RMS Preparation since 2016",
  get principal() { return sysOr("principal_name", "Principal"); },
  teacher: "Class Teacher",
  get logoUrl() { return sysOr("logo_url", "https://postimg.cc/HrDFYwKn"); },
  get academicYear() { return sysOr("session_year", "2026-2027"); },
  examDate: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getGrade(pct, scale = GRADE_PRESETS) {
  for (const g of scale) if (pct >= g.min) return g;
  return scale[scale.length - 1];
}

function printHTML(html, title = "GNSI") {
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html><head><title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet"/>
  <style>
    *{box-sizing:border-box;margin:0;padding:0;}
    :root{--bg:#F0F4FF;--bg2:#DBEAFE;--border:#BFDBFE;--text:#1C1A16;--text2:#3b5ca8;--accent:#0f2d5e;--gold:#b8923a;}
    body{font-family:'Inter',sans-serif;background:var(--bg);color:var(--text);padding:28px;-webkit-font-smoothing:antialiased;}
    .page{max-width:720px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.10);}
    .header{background:linear-gradient(135deg,#0f2d5e 0%,#1a4d8a 60%,#2563b0 100%);color:#fff;padding:28px 36px 22px;text-align:center;position:relative;}
    .header::after{content:'';display:block;position:absolute;bottom:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#b8923a,#b8923a,#b8923a);}
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
  input: { padding: "7px 11px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box", color: "#0f1b2e", fontFamily: "'DM Sans',sans-serif" },
  btn:   { padding: "8px 18px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" },
};

// ─── Phone card layout for data tables ───────────────────────────────────────
// Any <table className="gx-rt"> turns into one card per row on phones (< 768px):
// the name / subject becomes the card title, every other column becomes a
// labelled tile, rank / # sits in the corner, a leading checkbox sits top-right
// and Actions / Print buttons get their own row. Labels are copied from each
// table's own header row at runtime, so no table needs per-cell changes.
// Desktop is untouched. Set PHONE_CARD_TABLES to false to fall back to the old
// sideways-scrolling tables.
const PHONE_CARD_TABLES = true;

const CARD_TABLE_CSS = `
@media (max-width: 767.98px) {
  div:has(> table.gx-rt) { border: 0 !important; background: transparent !important; box-shadow: none !important; overflow: visible !important; max-height: none !important; }
  table.gx-rt, table.gx-rt tbody, table.gx-rt tfoot { display: block !important; width: 100% !important; min-width: 0 !important; border: 0 !important; background: transparent !important; }
  table.gx-rt thead { display: none !important; }
  table.gx-rt tr { display: grid !important; grid-template-columns: repeat(2, minmax(0, 1fr)); column-gap: 14px; row-gap: 2px; position: relative; margin: 0 0 10px !important; padding: 10px 12px !important; background: #fff; border: 1px solid #E5E7EB !important; border-left: 4px solid #132a4f !important; border-radius: 12px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
  table.gx-rt td { display: block !important; position: static !important; width: auto !important; min-width: 0 !important; padding: 4px 0 !important; border: 0 !important; background: transparent !important; text-align: left !important; white-space: normal !important; font-size: 13px !important; overflow-wrap: anywhere; }
  table.gx-rt td:empty { display: none !important; }
  table.gx-rt td::before { content: attr(data-label); display: block; margin-bottom: 1px; font-size: 10.5px; font-weight: 700; color: #94A3B8; }
  table.gx-rt td[data-label=""]::before, table.gx-rt td[data-rt="title"]::before, table.gx-rt td[data-rt="corner"]::before, table.gx-rt td[data-rt="bare"]::before, table.gx-rt td[data-rt="actions"]::before { display: none; }
  table.gx-rt td[data-rt="title"] { grid-column: 1 / -1; order: -1; margin-bottom: 4px; padding: 0 0 8px !important; border-bottom: 1px solid #F1F5F9 !important; font-size: 14.5px !important; font-weight: 700; }
  table.gx-rt[data-rt-pad] td[data-rt="title"] { padding-right: 44px !important; }
  table.gx-rt td[data-rt="corner"] { position: absolute !important; top: 10px; right: 12px; padding: 0 !important; text-align: right !important; font-size: 15px !important; font-weight: 800; }
  table.gx-rt td[data-rt="bare"] { position: absolute !important; top: 8px; right: 10px; padding: 0 !important; }
  table.gx-rt td[data-rt="bare"] input[type="checkbox"] { width: 22px; height: 22px; }
  table.gx-rt td[data-rt="actions"] { grid-column: 1 / -1; display: flex !important; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 6px; padding: 8px 0 0 !important; border-top: 1px solid #F1F5F9 !important; }
  table.gx-rt td[data-rt="actions"] button { min-height: 36px; }
  table.gx-rt td[data-rt="wide"] { grid-column: 1 / -1; text-align: center !important; }
  table.gx-rt td input, table.gx-rt td select { max-width: 100%; }
}
`;

const RT_CORNER  = /^(#|rank|row|sl\.?|s\.?\s?no\.?)$/i;
const RT_ACTIONS = /^(actions?|print)$/i;
const RT_TITLE   = [/^student( name)?$/i, /name/i, /^subject$/i, /^session$/i, /^course$/i, /^date$/i, /^batch$/i];

function labelCardTables() {
  const setAttr = (el, k, v) => { if (el.getAttribute(k) !== v) el.setAttribute(k, v); };
  document.querySelectorAll("table.gx-rt").forEach(table => {
    const headRow = table.querySelector("thead tr");
    if (!headRow) return;
    const heads = Array.from(headRow.children).map(th => (th.textContent || "").replace(/\s+/g, " ").trim());
    const roles = heads.map((h, i) => {
      if (h === "") return i === 0 ? "bare" : "actions";   // leading blank = select checkbox, later blank = buttons
      if (RT_ACTIONS.test(h)) return "actions";
      if (RT_CORNER.test(h)) return "corner";
      return "field";
    });
    let titleIdx = Number(table.getAttribute("data-rt-title")) - 1;   // optional 1-based override
    if (!(titleIdx >= 0 && titleIdx < heads.length)) {
      titleIdx = -1;
      for (const re of RT_TITLE) {
        const i = heads.findIndex((h, k) => roles[k] === "field" && re.test(h));
        if (i >= 0) { titleIdx = i; break; }
      }
      if (titleIdx < 0) titleIdx = roles.indexOf("field");
    }
    table.toggleAttribute("data-rt-pad", roles.some(r => r === "bare" || r === "corner"));
    table.querySelectorAll(":scope > tbody > tr, :scope > tfoot > tr").forEach(tr => {
      let col = 0;
      for (const td of tr.children) {
        const span = td.colSpan || 1;
        if (span > 1 || col >= heads.length) {           // empty-state / summary rows
          setAttr(td, "data-rt", "wide"); setAttr(td, "data-label", "");
          col += span; continue;
        }
        setAttr(td, "data-rt", col === titleIdx ? "title" : roles[col]);
        setAttr(td, "data-label", roles[col] === "field" ? heads[col] : "");
        col += 1;
      }
    });
  });
}

function CardTableEngine({ enabled }) {
  const on = enabled && PHONE_CARD_TABLES;
  useEffect(() => {
    if (!on) return undefined;
    let raf = 0;
    const run = () => { raf = 0; labelCardTables(); };
    const schedule = () => { if (!raf) raf = requestAnimationFrame(run); };
    run();
    const mo = new MutationObserver(schedule);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => { mo.disconnect(); if (raf) cancelAnimationFrame(raf); };
  }, [on]);
  return on ? <style>{CARD_TABLE_CSS}</style> : null;
}

// ─── Small presentational pieces ──────────────────────────────────────────────
// Declared at module level (not inside the screens that use them) so React keeps
// them mounted between renders; everything they need arrives through props.
const EXAM_STEP_LABELS = ["Basic Info", "Courses", "Subjects & Marks", "Sessions", "Review"];

function FieldLabel({ children }) {
  return (
    <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>{children}</label>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div style={{ background:"white", borderRadius:8, padding:"10px 14px", boxShadow:"0 1px 4px rgba(0,0,0,0.06)", borderLeft:`3px solid ${color||"#132a4f"}` }}>
      <div style={{ fontSize:10, fontWeight:700, color:"#5d6b82", textTransform:"uppercase", letterSpacing:".08em", marginBottom:3 }}>{label}</div>
      <div style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:600, color:color||"#132a4f" }}>{value}</div>
    </div>
  );
}

function ModeBtn({ id, icon, label, mode, setMode, isMobile }) {
  return (
    <button onClick={() => setMode(id)}
      style={{ ...css.btn, padding: isMobile ? "7px 10px" : "8px 16px", background: mode === id ? "#132a4f" : "#f3f0e8", color: mode === id ? "white" : "#2e3b52", border: mode === id ? "none" : "1px solid #E5E7EB", fontSize: isMobile ? 11 : 12 }}>
      {icon} {isMobile ? "" : label}
    </button>
  );
}

function SectionBtn({ id, icon, label, count, activeSection, setActiveSection, isMobile }) {
  return (
    <button onClick={() => setActiveSection(id)}
      style={{ display:"flex", alignItems:"center", gap:10, padding: isMobile ? "12px 14px" : "14px 24px", borderRadius:10, border: activeSection===id ? "2px solid #132a4f" : "2px solid #E5E7EB", background: activeSection===id ? "#132a4f" : "white", color: activeSection===id ? "white" : "#2e3b52", cursor:"pointer", fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize: isMobile ? 13 : 14, flex:1, transition:"all .15s" }}>
      <span style={{ fontSize: isMobile ? 18 : 22 }}>{icon}</span>
      <div style={{ textAlign:"left" }}>
        <div>{label}</div>
        <div style={{ fontSize:11, fontWeight:400, opacity:0.7 }}>{count} students</div>
      </div>
    </button>
  );
}

function StepBar({ step, setStep, isMobile }) {
  return (
    <div style={{ display:"flex", alignItems:"center", marginBottom:24, gap:0 }}>
      {EXAM_STEP_LABELS.map((label, i) => {
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
                background: done ? "#132a4f" : active ? "#1e3a6e" : "#f3f0e8",
                color: (done || active) ? "white" : "#8a93a6",
                border: active ? "2px solid #132a4f" : "none",
              }}>
                {done ? "✓" : n}
              </div>
              {!isMobile && <div style={{ fontSize:9, fontWeight:700, color: active ? "#132a4f" : done ? "#0F6E56" : "#8a93a6", textTransform:"uppercase", letterSpacing:".08em", whiteSpace:"nowrap" }}>{label}</div>}
            </div>
            {i < EXAM_STEP_LABELS.length - 1 && (
              <div style={{ flex:1, height:2, background: step > n ? "#132a4f" : "#e8e3d8", margin:"0 4px 18px" }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function NavButtons({ step, setStep, totalSteps, canNext, handleSave, saving, isEdit }) {
  return (
    <div style={{ display:"flex", gap:10, marginTop:24, paddingTop:16, borderTop:"1px solid #F1F5F9" }}>
      {step > 1 && <button onClick={() => setStep(s => s-1)} style={{ ...css.btn, background:"#f3f0e8", color:"#2e3b52", flex:1 }}>← Back</button>}
      {step < totalSteps
        ? <button onClick={() => setStep(s => s+1)} disabled={!canNext()} style={{ ...css.btn, background:canNext()?"#132a4f":"#d9d2c2", color:"white", flex:2, fontSize:14 }}>
            Next →
          </button>
        : <button onClick={handleSave} disabled={saving} style={{ ...css.btn, background:saving?"#b7c6e0":"#16A34A", color:"white", flex:2, fontSize:14 }}>
            {saving ? "⏳ Saving…" : isEdit ? "✅ Save Changes" : "✅ Create Exam Format"}
          </button>
      }
    </div>
  );
}

// ─── Micro-components ─────────────────────────────────────────────────────────
function Spinner({ small }) {
  return <div style={{ padding: small ? 8 : 40, textAlign: "center", color: "#8a93a6", fontSize: small ? 12 : 14 }}>⏳ Loading…</div>;
}
function Badge({ label, color, bg }) {
  return <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 999, fontSize: 12, fontWeight: 700, color, background: bg }}>{label}</span>;
}
function SaveBtn({ onClick, saving, saved, label = "Save" }) {
  return (
    <button onClick={onClick} disabled={saving} style={{ ...css.btn, background: saved ? "#16A34A" : saving ? "#b7c6e0" : "#1e3a6e", color: "white" }}>
      {saved ? "✓ Saved!" : saving ? "Saving…" : `💾 ${label}`}
    </button>
  );
}

// ─── Course selector pill bar ─────────────────────────────────────────────────
function CoursePicker({ courses, value, onChange, label = "Batch / Course" }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 6, textTransform: "uppercase" }}>{label}</label>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {courses.map(c => (
          <button key={c} onClick={() => onChange(c)}
            style={{ ...css.btn, padding: "6px 14px", background: value === c ? "#132a4f" : "#f3f0e8", color: value === c ? "white" : "#2e3b52", border: value === c ? "none" : "1px solid #E5E7EB", fontSize: 12 }}>
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
    gold: "linear-gradient(90deg,#b8923a,#b8923a)", purple: "linear-gradient(90deg,#534AB7,#7B68EE)",
    red:  "linear-gradient(90deg,#A32D2D,#DC4444)", teal: "linear-gradient(90deg,#0891b2,#7e95c2)",
  };
  return (
    <div style={{ background: "white", borderRadius: 12, padding: "16px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: strips[strip] || strips.blue }} />
      <div style={{ fontSize: 10.5, fontWeight: 700, color: color || "#5d6b82", textTransform: "uppercase", letterSpacing: ".1em", marginBottom: 10, marginTop: 2 }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display',Georgia,serif", fontSize: 34, fontWeight: 600, lineHeight: 1, color: color || "#14213d", letterSpacing: "-.5px", marginBottom: 6 }}>{value}</div>
      {sub && <div style={{ fontSize: 12.5, color: "#8a93a6" }}>{sub}</div>}
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

// Which tabs the signed-in user may see (shared by the desktop tab bar and the
// phone home / bottom navigation).
function visibleTabGroups({ perms, isAdmin, currentUser }) {
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

  return TAB_GROUPS
    .map((g) => ({ ...g, tabs: g.tabs.filter((t) => canShow(t.id)) }))
    .filter((g) => g.tabs.length > 0);
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

function MarkEntry({ courseSubjects, examTypes, students, currentUser, perms, initialCourse, initialExamType, initialExamDate }) {
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
  const [addingStudent] = useState(false);
  const [addStudentError, setAddStudentError] = useState("");
  const [importSaveError, setImportSaveError] = useState("");
  const [lastImportSummary, setLastImportSummary] = useState(null); // persists after the import panel closes, so the save is never invisible
  const [absentSet, setAbsentSet] = useState(new Set());
  const fileInputRef = useRef(null);
  const [isDirty, setIsDirty] = useState(false); // true once any mark changes since last successful save
  const [bulkFillValues, setBulkFillValues] = useState({}); // { [subject]: string } — the bulk-fill input per subject column
  const [bulkOpen, setBulkOpen] = useState(false); // phone: "fill one subject for everyone" panel expanded
  const [bulkSub, setBulkSub] = useState("");       // phone: subject currently picked in that panel
  const [navH, setNavH] = useState(0);              // phone: height of the fixed bottom navigation
  useEffect(() => {
    if (!isMobile) return undefined;
    const measure = () => { const el = document.querySelector(".xm-bottom"); setNavH(el ? el.offsetHeight : 0); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isMobile]);

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

  // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
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
    await ensureLibs(); const XLSX = window.XLSX; let rows;
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
      // Recognize "COMBINED NAVODAY(A) ENG/MAN/MM"-style text and resolve it to
      // the ONE real course key regardless of spelling variants or which
      // section it names — ENG/MM is a secondary-batch tag, never a separate
      // courseSubjects key, so this must be checked BEFORE the generic
      // raw/key match below. Otherwise a stray junk key with matching text
      // (e.g. an old "COMBINED NAVODAY ENG" config entry) would be picked
      // instead, and importing would fail looking for a schedule under that
      // junk key. See matchesCourseBatch's own comment for the same family
      // of naming variants this handles.
      const isCombinedNavodayaText = raw && raw.includes("COMBINED NAVODAY");
      const realCombinedKey = "Combined Navodaya Course (Sainik Appearing Group)";
      if (isCombinedNavodayaText && courseSubjects[realCombinedKey]) {
        detectedCourse = realCombinedKey;
      } else if (raw && courseSubjects[raw]) detectedCourse = raw;
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

  const saveNewStudentFromError = async () => {
    // Student records are now managed exclusively in StudentDB (Attendance
    // module → Students tab). Exams no longer creates new student rows —
    // this keeps a single source of truth for course/batch, so add the
    // missing student there first, then re-run this import.
    setAddStudentError("This student isn't in the system yet. Please add them in StudentDB (Attendance → Students) first, then re-import this file — Exams no longer creates student records directly.");
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

  // ── Phone card entry ────────────────────────────────────────────────────
  // Enter / the keyboard's "Next" key walks across a student's subjects, then
  // drops to the next student's first subject. Subjects marked absent are
  // read-only, so they are skipped.
  const handleCardKeyDown = (e, row, col) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    let r = row, c = col;
    for (let n = 0; n < filtered.length * subjects.length; n++) {
      c += 1;
      if (c >= subjects.length) { c = 0; r += 1; }
      if (r >= filtered.length) { e.target.blur(); return; }
      if (!absentSet.has(`${filtered[r].id}-${subjects[c]}`)) { focusCell(r, c); return; }
    }
  };

  // Scrolls to the next student (after the one being edited, wrapping round)
  // who still has an empty subject, and focuses that first empty box.
  const jumpToPending = () => {
    const active = document.activeElement;
    let start = 0;
    for (const [k, el] of Object.entries(cellRefs.current)) {
      if (el === active) { start = Number(k.split("-")[0]) + 1; break; }
    }
    for (let n = 0; n < filtered.length; n++) {
      const r = (start + n) % filtered.length;
      const sid = filtered[r].id;
      if (isStudentComplete(sid)) continue;
      const c = Math.max(0, subjects.findIndex(sub => {
        const v = marks[`${sid}-${sub}`];
        return v === "" || v === undefined || v === null;
      }));
      const el = cellRefs.current[`${r}-${c}`];
      if (el) { el.scrollIntoView({ block: "center", behavior: "smooth" }); el.focus({ preventScroll: true }); }
      return;
    }
  };

  // Mobile: compact controls stacked
  const controlsStyle = isMobile
    ? { display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }
    : { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18, alignItems: "flex-end" };

  const renderImportPreview = () => {
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
        let score;
        let matchReason;

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
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 600, color: "#14213d" }}>📂 Import Preview</div>
          <button onClick={closeImportPanel}
            style={{ ...css.btn, padding: "5px 12px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", fontSize: 12 }}>
            {importDone ? "✕ Close" : "✕ Cancel"}
          </button>
        </div>
        {importInfo && (
          <div style={{ background: "#eef2f9", border: "1px solid #BFDBFE", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12 }}>
            <span style={{ fontWeight: 700, color: "#1e3a6e" }}>🎯 Auto-detected: </span>
            <span style={{ fontWeight: 800, color: "#132a4f", background: "#D1FAE5", padding: "2px 10px", borderRadius: 999 }}>{importInfo.detectedCourse}</span>
          </div>
        )}

        {/* ── Subject column mapping: which spreadsheet column feeds which subject ──── */}
        {importInfo?.subjectColMap?.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: "#2e3b52", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 8 }}>
              📊 Subject Column Mapping
            </div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(260px,1fr))", gap: 8 }}>
              {importInfo.subjectColMap.map(({ sub, col, matchType, confidence }) => (
                <div key={sub} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: matchType === "none" ? "#FFFBEB" : "#faf8f3", border: `1px solid ${matchType === "none" ? "#FDE68A" : "#e8e3d8"}`, borderRadius: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#14213d", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
                    <div style={{ fontSize: 10, color: "#8a93a6" }}>/{importInfo?.maxMarksBySubject?.[sub] ?? getSubjectMax(detCourse, sub)} marks</div>
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
          <div style={{ flex: 1, minWidth: 80, background: importErrors.length ? "#FCEBEB" : "#faf8f3", border: `1px solid ${importErrors.length ? "#FECACA" : "#e8e3d8"}`, borderRadius: 8, padding: "10px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: importErrors.length ? "#A32D2D" : "#8a93a6", textTransform: "uppercase" }}>Unmatched</div>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 600, color: importErrors.length ? "#A32D2D" : "#8a93a6" }}>{importErrors.length}</div>
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
                        <div style={{ fontWeight: 700, fontSize: 13, color: "#14213d" }}>{err.rawName || "(no name in row)"}</div>
                        <div style={{ fontSize: 11, color: "#8a93a6" }}>
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
                          style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: isOpen ? "#132a4f" : "#eef2f9", color: isOpen ? "white" : "#1e3a6e", border: isOpen ? "none" : "1px solid #BFDBFE" }}>
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
                      <div style={{ marginTop: 10, padding: "10px 12px", background: "#faf8f3", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                        <input
                          autoFocus
                          value={query}
                          onChange={e => setManualSearch(p => ({ ...p, [idx]: e.target.value }))}
                          placeholder={err.rawGcc ? `GCC ${err.rawGcc} or name…` : (err.rawName ? `Similar to: ${err.rawName}…` : "Search: name, GCC, or admission#…")}
                          style={{ ...css.input, fontSize: 12, marginBottom: 8, width: "100%" }}
                        />
                        <div style={{ fontSize: 10, color: "#5d6b82", marginBottom: 8, background: "white", padding: "6px 8px", borderRadius: 4 }}>
                          💡 Try: first/last name, GCC number, admission number, or partial name match
                        </div>
                        
                        {/* Quick filters */}
                        <div style={{ marginBottom: 10, paddingTop: 8, borderTop: "1px solid #E5E7EB" }}>
                          <div style={{ fontSize: 9, fontWeight: 700, color: "#5d6b82", marginBottom: 6, textTransform: "uppercase" }}>🎯 Filter by Batch:</div>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            <button 
                              onClick={() => setManualSearchFilter(p => ({ ...p, [idx]: {} }))}
                              style={{ ...css.btn, padding: "3px 8px", fontSize: 10, background: !manualSearchFilter[idx]?.batch ? "#132a4f" : "#f3f0e8", color: !manualSearchFilter[idx]?.batch ? "white" : "#2e3b52", border: "none", borderRadius: 4 }}>
                              ✕ Clear
                            </button>
                            {courses.map(c => (
                              <button key={c}
                                onClick={() => setManualSearchFilter(p => ({ ...p, [idx]: { batch: manualSearchFilter[idx]?.batch === c ? undefined : c } }))}
                                style={{ ...css.btn, padding: "3px 8px", fontSize: 10, background: manualSearchFilter[idx]?.batch === c ? "#a7771f" : "#f3f0e8", color: manualSearchFilter[idx]?.batch === c ? "white" : "#2e3b52", border: manualSearchFilter[idx]?.batch === c ? "none" : "1px solid #E5E7EB", borderRadius: 4 }}>
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
                              
                              let matchBg = "#F0FDF4", matchColor = "#15803D", matchLabel;
                              if (normalizeGccValue(q) === normGcc) matchLabel = "GCC match";
                              else if (String(s.gcc_no).includes(q)) { matchLabel = "GCC substring"; matchBg = "#FEF3C7"; matchColor = "#92400E"; }
                              else if (normAdm === q) matchLabel = "Admission# exact";
                              else if (normAdm && normAdm.includes(q)) { matchLabel = "Admission# partial"; matchBg = "#FEF3C7"; matchColor = "#92400E"; }
                              else if (normName === q) matchLabel = "Name exact";
                              else matchLabel = "Partial match";

                              return (
                                <div key={s.id} onClick={() => assignStudentToError(idx, s)}
                                  style={{ padding: "8px 10px", borderRadius: 6, background: "white", border: "2px solid #E5E7EB", cursor: "pointer", fontSize: 12, display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all 0.15s", }}
                                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#2f4f86"; e.currentTarget.style.background = "#eef2f9"; }}
                                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e8e3d8"; e.currentTarget.style.background = "white"; }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, color: "#1F2937", marginBottom: 2 }}>{s.name}</div>
                                    <div style={{ fontSize: 10, color: "#5d6b82" }}>
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
                            <div style={{ fontSize: 11, color: "#8a93a6", padding: "8px 10px", textAlign: "center", background: "#faf8f3", borderRadius: 6 }}>
                              <div style={{ marginBottom: 4 }}>🔍 No matching students found</div>
                              <div style={{ fontSize: 10, color: "#8a93a6" }}>Try: name, GCC, or admission number</div>
                            </div>
                          )}
                        </div>
                    )}
                    {isAddOpen && (
                      <div style={{ marginTop: 10, padding: 12, background: "white", border: "1px solid #E5E7EB", borderRadius: 8 }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: "#132a4f", marginBottom: 8 }}>➕ Register as New Student</div>
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
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#5d6b82", marginBottom: 4, textTransform: "uppercase" }}>Track</div>
                          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                            {TRACKS.map(t => (
                              <button key={t} onClick={() => setNewStudentForm(p => ({ ...p, track: t, batch: TRACK_BATCHES[t][0] || p.batch }))}
                                style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: newStudentForm.track === t ? "#132a4f" : "#f3f0e8", color: newStudentForm.track === t ? "white" : "#2e3b52", border: newStudentForm.track === t ? "none" : "1px solid #E5E7EB" }}>
                                {t}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, color: "#5d6b82", marginBottom: 4, textTransform: "uppercase" }}>Batch</div>
                          {batchesForTrack(newStudentForm.track).length > 0 && (
                            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 6 }}>
                              {batchesForTrack(newStudentForm.track).map(b => (
                                <button key={b} onClick={() => setNewStudentForm(p => ({ ...p, batch: b }))}
                                  style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: newStudentForm.batch === b ? "#a7771f" : "#fbf3e0", color: newStudentForm.batch === b ? "white" : "#5B21B6", border: newStudentForm.batch === b ? "none" : "1px solid #DDD6FE" }}>
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
                          <button onClick={() => setAddNewOpenIdx(null)} style={{ ...css.btn, flex: 1, background: "#f3f0e8", color: "#2e3b52", fontSize: 12 }}>Cancel</button>
                          <button onClick={() => saveNewStudentFromError(idx)} disabled={addingStudent}
                            style={{ ...css.btn, flex: 2, background: addingStudent ? "#b7c6e0" : "#16A34A", color: "white", fontSize: 12 }}>
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
              <table className="gx-rt" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 500 }}>
                <thead style={{ position: "sticky", top: 0 }}>
                  <tr style={{ background: "#132a4f" }}>
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
                      <tr key={st.id} style={{ background: i % 2 ? "#faf8f3" : "white", borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "7px 8px", textAlign: "center", fontWeight: 800, color: rank <= 3 ? "#D97706" : "#8a93a6", fontSize: rank <= 3 ? 14 : 12 }}>
                          {rank <= 3 ? medals[rank - 1] : `#${rank}`}
                        </td>
                        <td style={{ padding: "7px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>{st.name}</td>
                        <td style={{ padding: "7px 8px", textAlign: "center" }}><MatchBadge matchType={matchType} confidence={confidence} /></td>
                        {previewSubjects.map(sub => (
                          <td key={sub} style={{ padding: "7px 8px", textAlign: "center", color: subMarks[sub] !== undefined ? "#14213d" : "#d9d2c2", fontWeight: subMarks[sub] !== undefined ? 600 : 400 }}>
                            {subMarks[sub] !== undefined ? subMarks[sub] : "--"}
                          </td>
                        ))}
                        <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 800 }}>{total}</td>
                        <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 700, color: getGrade(pct).color }}>{pct.toFixed(1)}%</td>
                      </tr>
                    );
                  })}
                  {!rankedImportRows.length && (
                    <tr><td colSpan={previewSubjects.length + 5} style={{ padding: 24, textAlign: "center", color: "#8a93a6" }}>No matched rows yet — resolve unmatched rows above, or skip them.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          );
        })()}
        <div style={{ fontSize: 11, color: "#8a93a6", marginTop: -10, marginBottom: 16 }}>
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
              style={{ ...css.btn, background: importing ? "#b7c6e0" : "#132a4f", color: "white", padding: "10px 24px", fontSize: 14, width: isMobile ? "100%" : "auto" }}>
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
      <div style={{ ...css.card, background: "#faf8f3", marginBottom: 14 }}>
        <CoursePicker courses={courses} value={course} onChange={c => confirmSwitch(setCourse, c)} />
        {subjects.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", gap: 5, flexWrap: "wrap" }}>
            {subjects.map(s => (
              <span key={s} style={{ fontSize: 11, padding: "3px 10px", background: "#eef2f9", color: "#1e3a6e", borderRadius: 999, fontWeight: 600 }}>
                {s} <span style={{ opacity: 0.6 }}>/{getSubMax(s)}</span>
              </span>
            ))}
            <span style={{ fontSize: 11, padding: "3px 10px", background: "#132a4f", color: "white", borderRadius: 999, fontWeight: 700 }}>Total: {courseMax}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={controlsStyle}>
        {isMobile ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 4, textTransform: "uppercase" }}>Exam Type</label>
                <select value={examType} onChange={e => confirmSwitch(setExamType, e.target.value)} style={{ ...css.input }}>
                  {examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 4, textTransform: "uppercase" }}>Date</label>
                <input type="date" value={examDate} onChange={e => confirmSwitch(setExamDate, e.target.value)} style={css.input} />
              </div>
            </div>
            <input placeholder="🔍 Search student…" value={search} onChange={e => setSearch(e.target.value)} style={css.input} />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <SaveBtn onClick={handleSave} saving={saving} saved={saved} label="Save Marks" />
              <button onClick={handleExport} style={{ ...css.btn, background: "#E1F5EE", color: "#0F6E56", border: "1px solid #BBF7D0" }}>📥 Excel</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <button onClick={downloadTemplate} style={{ ...css.btn, background: "#FAFAF9", color: "#5d6b82", border: "1px solid #E5E7EB", fontSize: 12 }}>📋 Template</button>
              {perm?.canImport !== false && <button onClick={() => fileInputRef.current?.click()} style={{ ...css.btn, background: "#a7771f", color: "white", fontSize: 12 }}>📂 Import</button>}
            </div>
          </>
        ) : (
          <>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
              <select value={examType} onChange={e => confirmSwitch(setExamType, e.target.value)} style={{ ...css.input, width: 180 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Exam Date</label>
              <input type="date" value={examDate} onChange={e => confirmSwitch(setExamDate, e.target.value)} style={{ ...css.input, width: 160 }} />
            </div>
            <div style={{ flex: 1, minWidth: 160 }}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Search Student</label>
              <input placeholder="Name…" value={search} onChange={e => setSearch(e.target.value)} style={css.input} />
            </div>
            <SaveBtn onClick={handleSave} saving={saving} saved={saved} label="Save Marks" />
            <button onClick={handleExport} style={{ ...css.btn, background: "#E1F5EE", color: "#0F6E56", border: "1px solid #BBF7D0" }}>📥 Excel</button>
            <div style={{ width: 1, background: "#e8e3d8", alignSelf: "stretch" }} />
            <button onClick={downloadTemplate} style={{ ...css.btn, background: "#FAFAF9", color: "#5d6b82", border: "1px solid #E5E7EB" }}>📋 Template</button>
            {perm?.canImport !== false && <button onClick={() => fileInputRef.current?.click()} style={{ ...css.btn, background: "#a7771f", color: "white" }}>📂 Import Excel / CSV</button>}
          </>
        )}
      </div>

      {saved && <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "10px 16px", borderRadius: 8, marginBottom: 14, fontSize: 13 }}>✅ Marks saved!</div>}
      {saveError && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "10px 16px", borderRadius: 8, marginBottom: 14, fontSize: 13 }}>⚠ Save failed: {saveError}</div>}
      {scheduleError && <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E", padding: "10px 16px", borderRadius: 8, marginBottom: 14, fontSize: 13 }}>📋 {scheduleError}</div>}
      {importMode && renderImportPreview()}

      {!loading && subjects.length > 0 && courseStudents.length > 0 && (
        <div style={{ background: "white", borderRadius: 10, padding: "10px 16px", marginBottom: 14, boxShadow: "0 1px 4px rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#5d6b82", marginBottom: 4 }}>
              <span>Entry progress</span>
              <span style={{ fontWeight: 700, color: progressPct === 100 ? "#0F6E56" : "#2e3b52" }}>{completeCount} / {courseStudents.length} students ({progressPct}%)</span>
            </div>
            <div style={{ height: 7, background: "#f3f0e8", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${progressPct}%`, background: progressPct === 100 ? "#16A34A" : "#132a4f", borderRadius: 999, transition: "width .3s" }} />
            </div>
          </div>
          {isDirty && (
            <span style={{ fontSize: 11.5, fontWeight: 700, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", padding: "4px 10px", borderRadius: 999, whiteSpace: "nowrap" }}>
              ● Unsaved changes
            </span>
          )}
        </div>
      )}

      {loading ? <Spinner /> : isMobile ? (
        <div>
          {/* Fill one subject for every visible student */}
          {subjects.length > 0 && filtered.length > 0 && (
            <div style={{ background: "white", border: "1px solid #E5E7EB", borderRadius: 12, marginBottom: 12, overflow: "hidden" }}>
              <button type="button" onClick={() => setBulkOpen(o => !o)}
                style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", border: "none", background: "transparent", fontSize: 13, fontWeight: 700, color: "#132a4f", cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                <span>⚡ Fill one subject for everyone</span>
                <span style={{ fontSize: 11, color: "#8a93a6" }}>{bulkOpen ? "▲" : "▼"}</span>
              </button>
              {bulkOpen && (() => {
                const sub = bulkSub && subjects.includes(bulkSub) ? bulkSub : subjects[0];
                return (
                  <div style={{ padding: "0 14px 14px", display: "grid", gridTemplateColumns: "minmax(0,1fr) 96px", gap: 8 }}>
                    <select value={sub} onChange={e => setBulkSub(e.target.value)} style={{ ...css.input, height: 42, fontSize: 14 }}>
                      {subjects.map(s => <option key={s} value={s}>{s} (/{getSubMax(s)})</option>)}
                    </select>
                    <input type="number" inputMode="decimal" min="0" max={getSubMax(sub)} placeholder="Marks"
                      value={bulkFillValues[sub] ?? ""}
                      onChange={e => setBulkFillValues(p => ({ ...p, [sub]: e.target.value }))}
                      style={{ ...css.input, height: 42, fontSize: 16, textAlign: "center" }} />
                    <button type="button" onClick={() => applyBulkFill(sub)}
                      style={{ ...css.btn, gridColumn: "1 / -1", background: "#132a4f", color: "white", padding: "11px 18px" }}>
                      Fill {filtered.length} student{filtered.length !== 1 ? "s" : ""}
                    </button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* One card per student */}
          {filtered.map((st, i) => {
            const total = getTotal(st.id);
            const pct = calcPctLocal(total);
            const g = getGrade(pct);
            const entered = subjects.filter(sub => {
              const v = marks[`${st.id}-${sub}`];
              return v !== "" && v !== undefined && v !== null;
            }).length;
            const complete = isStudentComplete(st.id);
            const stripe = complete ? "#16A34A" : entered > 0 ? "#F59E0B" : "#d9d2c2";
            return (
              <div key={st.id} style={{ background: "white", borderRadius: 12, marginBottom: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.07)", borderLeft: `4px solid ${stripe}`, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderBottom: "1px solid #F1F5F9" }}>
                  <div style={{ width: 28, height: 28, borderRadius: 999, background: "#eef2f9", color: "#132a4f", fontSize: 12, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, color: "#14213d", fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{st.name}</div>
                    <div style={{ fontSize: 11, color: "#8a93a6", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {st.class_name} · GCC {st.gcc_no}
                    </div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 800, color: "#0f1b2e" }}>
                      {total}<span style={{ fontSize: 11, fontWeight: 600, color: "#8a93a6" }}>/{courseMax}</span>
                    </div>
                    {entered > 0 ? (
                      <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end", marginTop: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: g.color }}>{pct.toFixed(0)}%</span>
                        <Badge label={g.label} color={g.color} bg={g.bg} />
                      </div>
                    ) : (
                      <div style={{ fontSize: 11, color: "#8a93a6", marginTop: 2 }}>Not started</div>
                    )}
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 8, padding: 10 }}>
                  {subjects.map((sub, colIdx) => {
                    const key = `${st.id}-${sub}`;
                    const val = marks[key];
                    const max = getSubMax(sub);
                    const absent = absentSet.has(key);
                    const overMax = val !== "" && val !== undefined && val !== null && Number(val) > max;
                    return (
                      <div key={sub} style={{ background: absent ? "#FEF2F2" : "#faf8f3", border: `1px solid ${absent ? "#FECACA" : "#e8e3d8"}`, borderRadius: 10, padding: "8px 8px 8px 10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 4, fontSize: 11, fontWeight: 700, color: "#4b5870", marginBottom: 6 }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{sub}</span>
                          <span style={{ color: "#8a93a6", fontWeight: 600, flexShrink: 0 }}>/{max}</span>
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <input type="number" inputMode="decimal" enterKeyHint="next" min="0" max={max} placeholder="--"
                            ref={setCellRef(i, colIdx)}
                            value={val ?? ""}
                            readOnly={absent}
                            aria-label={`${st.name} — ${sub} marks out of ${max}`}
                            onChange={e => handleMark(st.id, sub, e.target.value)}
                            onKeyDown={e => handleCardKeyDown(e, i, colIdx)}
                            onFocus={e => e.target.select()}
                            style={{ flex: 1, minWidth: 0, height: 42, boxSizing: "border-box", borderRadius: 8, border: overMax ? "1.5px solid #DC2626" : "1px solid #CBD5E1", textAlign: "center", fontSize: 18, fontWeight: 700, color: absent ? "#DC2626" : "#0f1b2e", background: overMax || absent ? "#FEF2F2" : "white", outline: "none", fontFamily: "'DM Sans',sans-serif" }} />
                          <button type="button" onClick={() => toggleAbsent(st.id, sub)} aria-pressed={absent}
                            title={absent ? "Marked absent — tap to undo" : "Mark absent"}
                            style={{ width: 42, height: 42, flexShrink: 0, borderRadius: 8, border: `1px solid ${absent ? "#DC2626" : "#e8e3d8"}`, background: absent ? "#DC2626" : "white", color: absent ? "white" : "#8a93a6", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: "'DM Sans',sans-serif" }}>
                            {absent ? "ABS" : "A"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {!filtered.length && (
            <div style={{ background: "white", borderRadius: 12, padding: 32, textAlign: "center", color: "#8a93a6", fontSize: 13 }}>
              No students found for <b>{course}</b>.
            </div>
          )}

          {/* Sticky save bar — stays in reach while scrolling long batches */}
          {filtered.length > 0 && subjects.length > 0 && (
            <div style={{ position: "sticky", bottom: navH ? navH + 8 : 8, zIndex: 20, marginTop: 6, background: "#132a4f", color: "white", borderRadius: 14, padding: "10px 12px calc(10px + env(safe-area-inset-bottom, 0px))", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 6px 20px rgba(19,42,79,0.35)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700 }}>{completeCount}/{courseStudents.length} students done</div>
                <div style={{ fontSize: 11, color: isDirty ? "#FCD34D" : "rgba(255,255,255,0.7)" }}>{isDirty ? "● Unsaved changes" : "No unsaved changes"}</div>
              </div>
              {completeCount < courseStudents.length && (
                <button type="button" onClick={jumpToPending}
                  style={{ ...css.btn, padding: "10px 12px", fontSize: 12, background: "rgba(255,255,255,0.14)", color: "white", border: "1px solid rgba(255,255,255,0.35)" }}>
                  Next pending
                </button>
              )}
              <button type="button" onClick={handleSave} disabled={saving}
                style={{ ...css.btn, padding: "10px 16px", background: saved ? "#16A34A" : "white", color: saved ? "white" : "#132a4f", opacity: saving ? 0.7 : 1 }}>
                {saved ? "✓ Saved" : saving ? "Saving…" : "💾 Save"}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? 12 : 13, minWidth: isMobile ? 500 : "auto" }}>
            <thead>
              <tr style={{ background: "#132a4f" }}>
                <th style={{ padding: isMobile ? "8px 10px" : "10px 14px", textAlign: "left", color: "white", fontWeight: 700, fontSize: isMobile ? 11 : 12, position: "sticky", left: 0, background: "#132a4f", zIndex: 2 }}>Student</th>
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
                  <th style={{ padding: "6px 14px", textAlign: "left", fontSize: 10, fontWeight: 700, color: "#5d6b82", position: "sticky", left: 0, background: "#F0F4F2", zIndex: 2 }}>⚡ Bulk fill</th>
                  {subjects.map(sub => (
                    <th key={sub} style={{ padding: "4px 3px" }}>
                      <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
                        <input type="number" min="0" max={getSubMax(sub)} placeholder="all"
                          value={bulkFillValues[sub] ?? ""}
                          onChange={e => setBulkFillValues(p => ({ ...p, [sub]: e.target.value }))}
                          onKeyDown={e => { if (e.key === "Enter") applyBulkFill(sub); }}
                          style={{ width: 34, padding: "3px 2px", borderRadius: 5, border: "1px solid #D1D5DB", textAlign: "center", fontSize: 11 }} />
                        <button onClick={() => applyBulkFill(sub)} title={`Fill ${sub} for all visible students`}
                          style={{ ...css.btn, padding: "2px 5px", fontSize: 10, background: "#132a4f", color: "white" }}>✓</button>
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
                  <tr key={st.id} style={{ background: i % 2 ? "#faf8f3" : "white", borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: isMobile ? "6px 10px" : "8px 14px", position: "sticky", left: 0, background: i % 2 ? "#faf8f3" : "white", zIndex: 1 }}>
                      <div style={{ fontWeight: 600, color: "#14213d", fontSize: isMobile ? 11 : 13, whiteSpace: "nowrap" }}>{st.name}</div>
                      <div style={{ fontSize: 10, color: "#8a93a6" }}>{st.class_name} · {st.gcc_no}</div>
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
                          style={{ display: "block", margin: "2px auto 0", fontSize: 8, padding: "1px 4px", borderRadius: 3, border: "1px solid #FECACA", background: absentSet.has(`${st.id}-${sub}`) ? "#FCA5A5" : "#faf8f3", color: absentSet.has(`${st.id}-${sub}`) ? "#DC2626" : "#8a93a6", cursor: "pointer", fontWeight: 700 }}>
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
                <tr><td colSpan={subjects.length + 4} style={{ padding: 32, textAlign: "center", color: "#8a93a6" }}>No students found for <b>{course}</b>.</td></tr>
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
    setDatesLoaded(false);
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]); else setExamDate("");
      setDatesLoaded(true);
    });
  }, [examType]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
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
      <div style={{ ...css.card, background: "#faf8f3", marginBottom: 14 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setMarks({}); }} />
      </div>
      <div style={{ display: "flex", gap: isMobile ? 8 : 12, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 180 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select>
        </div>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Date</label>
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
          <table className="gx-rt" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: isMobile ? 480 : "auto" }}>
            <thead><tr style={{ background: "#132a4f" }}>
              <th style={{ padding: "10px 14px", textAlign: "left", color: "white", fontWeight: 700, fontSize: 12, position: isMobile ? "sticky" : "static", left: 0, background: "#132a4f", zIndex: 2 }}>Student</th>
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
                  <tr key={st.id} style={{ background: i % 2 ? "#faf8f3" : "white", borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "8px 14px", fontWeight: 600, color: "#14213d", position: isMobile ? "sticky" : "static", left: 0, background: i % 2 ? "#faf8f3" : "white", zIndex: 1 }}>
                      {st.name}<div style={{ fontSize: 10, color: "#8a93a6" }}>GCC {st.gcc_no}</div>
                    </td>
                    {subjects.map(sub => <td key={sub} style={{ padding: "8px 6px", textAlign: "center", fontSize: 12 }}>{marks[`${st.id}-${sub}`] ?? <span style={{ color: "#d9d2c2" }}>--</span>}</td>)}
                    <td style={{ padding: "8px 8px", textAlign: "center", fontWeight: 800 }}>{total}<span style={{ fontSize: 10, color: "#8a93a6" }}>/{courseMax}</span></td>
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
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
      chartsRef.current.forEach(c => { try { if (c && typeof c.destroy === "function") c.destroy(); } catch { /* ignore */ } });
      chartsRef.current = [];
      if (gradeRef.current) {
        const labels = GRADE_PRESETS.map(g => g.label);
        chartsRef.current.push(new Chart(gradeRef.current, { type: "doughnut", data: { labels, datasets: [{ data: labels.map(l => gradeCounts[l] || 0), backgroundColor: GRADE_PRESETS.map(g => g.color), borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } } }));
      }
      if (subjectRef.current) {
        chartsRef.current.push(new Chart(subjectRef.current, { type: "bar", data: { labels: subjects, datasets: [{ label: "Avg %", data: subjects.map(s => subjectAvgPct[s]), backgroundColor: "#1e3a6e", borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } } }));
      }
      if (passRef.current) {
        chartsRef.current.push(new Chart(passRef.current, { type: "bar", data: { labels: subjects, datasets: [{ label: "Pass Rate %", data: subjects.map(s => Math.round((subjectPass[s] / n) * 100)), backgroundColor: "#185FA5", borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 100 } }, plugins: { legend: { display: false } } } }));
      }
    });
    return () => { chartsRef.current.forEach(c => { try { c.destroy(); } catch { /* ignore */ } }); chartsRef.current = []; };
  }, [marks, course]);

  const chartH = isMobile ? 220 : 260;

  return (
    <div>
      <div style={{ ...css.card, background: "#faf8f3", marginBottom: 14 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setMarks({}); }} />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 180 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select>
        </div>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Date</label>
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 160 }}>{dates.map(d => <option key={d} value={d}>{d}</option>)}</select>
        </div>
      </div>

      {/* Stat cards — 2-col on mobile */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill,minmax(180px,1fr))", gap: isMobile ? 10 : 14, marginBottom: 20 }}>
        <DashStatCard label={`${course} Students`} value={courseStudents.length} strip="blue" color="#185FA5" />
        <DashStatCard label="Class Average" value={`${classAvg}%`} strip="teal" color="#0891b2" />
        <DashStatCard label="Pass Rate" value={`${Math.round(passed / n * 100)}%`} sub={`${passed} passed`} strip="green" color="#0F6E56" />
        <DashStatCard label="Highest" value={`${highest}/${courseMax}`} strip="gold" color="#b8923a" />
        <DashStatCard label="Lowest" value={`${lowest}/${courseMax}`} strip="red" color="#A32D2D" />
      </div>

      {/* Charts — side-by-side on desktop, stacked on mobile */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <div style={css.card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#14213d", fontFamily: "'Playfair Display',serif" }}>Grade Distribution</div>
            <button onClick={() => { if (!gradeRef.current) return; const a = document.createElement("a"); a.download = `grade-${course}.png`; a.href = gradeRef.current.toDataURL("image/png"); a.click(); }}
              style={{ ...css.btn, padding: "4px 10px", background: "#f3f0e8", color: "#2e3b52", border: "1px solid #E5E7EB", fontSize: 11 }}>⬇ PNG</button>
          </div>
          <div style={{ height: chartH }}><canvas ref={gradeRef} /></div>
        </div>
        <div style={css.card}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#14213d", marginBottom: 12, fontFamily: "'Playfair Display',serif" }}>Subject-wise Average %</div>
          <div style={{ height: chartH }}><canvas ref={subjectRef} /></div>
        </div>
      </div>
      <div style={css.card}>
        <div style={{ fontWeight: 700, fontSize: 14, color: "#14213d", marginBottom: 12, fontFamily: "'Playfair Display',serif" }}>Subject-wise Pass Rate</div>
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
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
  // dense rank by total (ties share a rank) — plain loop, no outer variables mutated
  const rankedWithRanks = (() => {
    let cr = 1, pt = null;
    const out = [];
    for (let i = 0; i < ranked.length; i++) {
      const st = ranked[i];
      if (i === 0) { cr = 1; pt = st.total; } else if (st.total !== pt) { cr++; pt = st.total; }
      out.push({ ...st, rank: cr });
    }
    return out;
  })();
  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div>
      <div style={{ ...css.card, background: "#faf8f3", marginBottom: 14 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setMarks({}); }} />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 180 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select>
        </div>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Date</label>
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
          const podiumColor = i === 0 ? "#b8923a" : i === 1 ? "#8a93a6" : "#CD7F32";
          return (
            <div key={st.id} style={{ ...css.card, textAlign: "center", borderTop: `4px solid ${podiumColor}`, position: "relative", padding: isMobile ? "14px 12px" : 20 }}>
              <div style={{ position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)", width: 24, height: 24, borderRadius: "50%", background: podiumColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 700, color: "white" }}>{i + 1}</div>
              <div style={{ fontSize: isMobile ? 28 : 32, marginTop: 10, marginBottom: 4 }}>{medals[i]}</div>
              <div style={{ fontWeight: 800, fontSize: isMobile ? 13 : 15 }}>{st.name}</div>
              <div style={{ fontSize: 11, color: "#8a93a6", marginBottom: 6 }}>GCC {st.gcc_no}</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: isMobile ? 22 : 28, fontWeight: 600, color: g.color }}>{st.total}<span style={{ fontSize: 12, color: "#8a93a6" }}>/{courseMax}</span></div>
              <div style={{ fontSize: 13, color: g.color, fontWeight: 700, marginBottom: 6 }}>{st.pct.toFixed(1)}%</div>
              <div><Badge label={g.label} color={g.color} bg={g.bg} /></div>
            </div>
          );
        })}
      </div>

      {/* Full rankings table — scrollable on mobile */}
      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", background: "#132a4f", color: "white", fontWeight: 700, fontSize: 13 }}>🏆 Full Rankings — {course}</div>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table className="gx-rt" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: isMobile ? 380 : "auto" }}>
            <thead><tr style={{ background: "#faf8f3", borderBottom: "2px solid #E5E7EB" }}>
              {["Rank", "Student", "GCC", "Total", "%", "Grade"].map(h => <th key={h} style={{ padding: "10px 10px", textAlign: h === "Student" ? "left" : "center", fontWeight: 700, color: "#2e3b52", fontSize: 11 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {rankedWithRanks.map((st, i) => {
                const g = getGrade(st.pct);
                return (
                  <tr key={st.id} style={{ background: i % 2 ? "#faf8f3" : "white", borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "9px 10px", textAlign: "center", fontWeight: 800, color: st.rank <= 3 ? "#D97706" : "#8a93a6", fontSize: st.rank <= 3 ? 15 : 12 }}>{st.rank <= 3 ? medals[st.rank - 1] : `#${st.rank}`}</td>
                    <td style={{ padding: "9px 10px", fontWeight: 600, fontSize: isMobile ? 12 : 13 }}>{st.name}</td>
                    <td style={{ padding: "9px 10px", textAlign: "center", color: "#5d6b82", fontSize: 12 }}>{st.gcc_no || "—"}</td>
                    <td style={{ padding: "9px 10px", textAlign: "center", fontWeight: 800 }}>{st.total}<span style={{ fontSize: 10, color: "#8a93a6" }}>/{courseMax}</span></td>
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
    if (!examType || !course) { setScheduledSubjects([]); return; }
    supabase.from("exam_schedule").select("id, subject, total_marks, exam_date").eq("exam_type_id", examType).eq("course", course).order("exam_date").then(({ data }) => {
      setScheduledSubjects(data || []);
    });
  }, [examType, course]);

  useEffect(() => {
    if (!selectedStudent || !examType || !dates.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
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
      if (chartInstance.current) { try { chartInstance.current.destroy(); } catch { /* ignore */ } }
      const colors = ["#1e3a6e","#185FA5","#a7771f","#d97706","#0891b2","#e11d48","#84cc16"];
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
      datasets.push({ label: "Total", data: totalsData, borderColor: "#132a4f", backgroundColor: "#132a4f22", tension: 0.4, fill: true, borderWidth: 3, pointRadius: 5, pointHoverRadius: 7, spanGaps: true, yAxisID: "y2" });
      chartInstance.current = new Chart(chartRef.current, {
        type: "line", data: { labels: dates, datasets },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: "index", intersect: false },
          plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } },
          scales: { x: { grid: { color: "#f3f0e8" } }, y: { beginAtZero: true, grid: { color: "#f3f0e8" }, title: { display: !isMobile, text: "Subject Marks" } }, y2: { beginAtZero: true, position: "right", max: courseMax, grid: { display: false }, title: { display: !isMobile, text: `Total /${courseMax}` } } } },
      });
    });
    return () => { if (chartInstance.current) { try { chartInstance.current.destroy(); } catch { /* ignore */ } } };
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
      <div style={{ ...css.card, background: "#faf8f3", marginBottom: 14 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setSelectedStudent(null); setAllMarks([]); }} />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => { setExamType(e.target.value); setAllMarks([]); }} style={{ ...css.input, width: isMobile ? "100%" : 200 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select>
        </div>
      </div>

      {/* Layout: stacked on mobile, side-by-side on desktop */}
      <div style={{ display: isMobile ? "flex" : "grid", flexDirection: "column", gridTemplateColumns: "280px 1fr", gap: isMobile ? 14 : 20 }}>
        {/* Student selector */}
        <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", background: "#132a4f", color: "white", fontWeight: 700, fontSize: 13 }}>👤 Select Student</div>
          <div style={{ padding: 10 }}><input placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...css.input, marginBottom: 8, fontSize: 12 }} /></div>
          <div style={{ maxHeight: isMobile ? 200 : 480, overflowY: "auto" }}>
            {filteredStudents.map(st => (
              <div key={st.id} onClick={() => setSelectedStudent(st)}
                style={{ padding: "9px 16px", cursor: "pointer", borderBottom: "1px solid #F1F5F9", background: selectedStudent?.id === st.id ? "#E1F5EE" : "white" }}>
                <div style={{ fontWeight: 600, fontSize: 12, color: selectedStudent?.id === st.id ? "#0F6E56" : "#14213d" }}>{st.name}</div>
                <div style={{ fontSize: 10, color: "#8a93a6" }}>GCC {st.gcc_no} · {st.class_name}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel */}
        <div>
          {!selectedStudent ? (
            <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", padding: isMobile ? 32 : 60, textAlign: "center", color: "#8a93a6" }}>
              <div style={{ fontSize: isMobile ? 36 : 48, marginBottom: 12 }}>📈</div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Select a student to view their progress</div>
            </div>
          ) : loading ? <Spinner /> : (
            <>
              <div style={{ background: "linear-gradient(135deg,#132a4f,#1e3a6e)", borderRadius: 12, padding: isMobile ? "14px 16px" : "18px 24px", marginBottom: 14, color: "white", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
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
              ) : <div style={{ ...css.card, textAlign: "center", color: "#8a93a6", padding: 40 }}>No exam data found.</div>}

              {dateSummary.some(d => d.pct !== null) && (
                <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                  <div style={{ padding: "12px 18px", background: "#132a4f", color: "white", fontWeight: 700, fontSize: 13 }}>📋 Exam-wise Summary</div>
                  <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                    <table className="gx-rt" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: isMobile ? 400 : "auto" }}>
                      <thead><tr style={{ background: "#faf8f3", borderBottom: "2px solid #E5E7EB" }}>
                        <th style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700, color: "#2e3b52", fontSize: 11 }}>Date</th>
                        {subjects.map(s => <th key={s} style={{ padding: "9px 6px", textAlign: "center", fontWeight: 700, color: "#2e3b52", fontSize: 10, whiteSpace: "nowrap" }}>{s}</th>)}
                        <th style={{ padding: "9px 10px", textAlign: "center", fontWeight: 700, color: "#2e3b52", fontSize: 11 }}>Total</th>
                        <th style={{ padding: "9px 10px", textAlign: "center", fontWeight: 700, color: "#2e3b52", fontSize: 11 }}>%</th>
                        <th style={{ padding: "9px 10px", textAlign: "center", fontWeight: 700, color: "#2e3b52", fontSize: 11 }}>Grd</th>
                      </tr></thead>
                      <tbody>
                        {dateSummary.map((d, i) => (
                          <tr key={d.date} style={{ background: i % 2 ? "#faf8f3" : "white", borderBottom: "1px solid #F1F5F9" }}>
                            <td style={{ padding: "8px 12px", fontWeight: 600, fontSize: 12 }}>{d.date}</td>
                            {subjects.map(sub => { const m = resolvedMarks.find(r => r.subject === sub && r.exam_date === d.date); return <td key={sub} style={{ padding: "8px 6px", textAlign: "center", color: m ? "#14213d" : "#d9d2c2", fontSize: 12 }}>{m ? m.marks_obtained : "--"}</td>; })}
                            <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 800 }}>{d.pct !== null ? `${d.total}/${d.max}` : "--"}</td>
                            <td style={{ padding: "8px 10px", textAlign: "center", fontWeight: 700, color: d.grade?.color || "#8a93a6" }}>{d.pct !== null ? `${d.pct.toFixed(1)}%` : "--"}</td>
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
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
      if (chartInstance.current) { try { chartInstance.current.destroy(); } catch { /* ignore */ } }
      chartInstance.current = new Chart(chartRef.current, {
        type: "radar",
        data: { labels: subjects, datasets: selected.map((st, i) => ({ label: st.name.split(" ")[0], data: subjects.map(sub => Number(marks[`${st.id}-${sub}`]) || 0), borderColor: COMPARE_COLORS[i], backgroundColor: COMPARE_COLORS[i] + "33", borderWidth: 2, pointRadius: 4 })) },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom", labels: { boxWidth: 10, font: { size: 10 } } } }, scales: { r: { beginAtZero: true } } },
      });
    });
    return () => { if (chartInstance.current) { try { chartInstance.current.destroy(); } catch { /* ignore */ } } };
  }, [selected, marks]);

  const filteredStudents = courseStudents.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()) || String(s.gcc_no).includes(search));

  // On mobile, determine compare cards columns
  const compareCols = isMobile
    ? (selected.length <= 2 ? "1fr 1fr" : "1fr 1fr")
    : `repeat(${selected.length}, 1fr)`;

  return (
    <div>
      <div style={{ ...css.card, background: "#faf8f3", marginBottom: 14 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setSelected([]); setMarks({}); }} />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 200 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select>
        </div>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Date</label>
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 160 }}>{dates.map(d => <option key={d} value={d}>{d}</option>)}</select>
        </div>
        {!isMobile && <div style={{ fontSize: 12, color: "#8a93a6", alignSelf: "center" }}>Select 2–4 students</div>}
      </div>

      {isMobile && selected.length === 0 && (
        <div style={{ fontSize: 12, color: "#8a93a6", marginBottom: 10, textAlign: "center" }}>Tap students below to select 2–4 for comparison</div>
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
          <div style={{ padding: "12px 16px", background: "#132a4f", color: "white", fontWeight: 700, fontSize: 13 }}>Select Students ({selected.length}/4)</div>
          <div style={{ padding: 10 }}><input placeholder="🔍 Search…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...css.input, marginBottom: 8, fontSize: 12 }} /></div>
          <div style={{ maxHeight: isMobile ? 200 : 420, overflowY: "auto" }}>
            {filteredStudents.map(st => {
              const idx = selected.findIndex(s => s.id === st.id); const isSel = idx !== -1;
              return (
                <div key={st.id} onClick={() => toggleStudent(st)}
                  style={{ padding: "8px 14px", cursor: "pointer", borderBottom: "1px solid #F1F5F9", background: isSel ? COMPARE_COLORS[idx] + "18" : "white", display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 20, height: 20, borderRadius: "50%", background: isSel ? COMPARE_COLORS[idx] : "#e8e3d8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: isSel ? "white" : "#8a93a6", flexShrink: 0 }}>{isSel ? idx + 1 : ""}</div>
                  <div><div style={{ fontWeight: 600, fontSize: 12, color: isSel ? COMPARE_COLORS[idx] : "#14213d" }}>{st.name}</div><div style={{ fontSize: 10, color: "#8a93a6" }}>GCC {st.gcc_no}</div></div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Comparison panel */}
        <div>
          {selected.length < 2 ? (
            <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", padding: isMobile ? 32 : 60, textAlign: "center", color: "#8a93a6" }}>
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
                      <div style={{ fontWeight: 700, fontSize: isMobile ? 11 : 13, color: "#14213d", marginBottom: 2, paddingRight: 24, lineHeight: 1.3 }}>{st.name}</div>
                      <div style={{ fontSize: 10, color: "#8a93a6", marginBottom: 8 }}>GCC {st.gcc_no}</div>
                      <div style={{ fontFamily: "'Playfair Display',serif", fontSize: isMobile ? 22 : 28, fontWeight: 600, color: COMPARE_COLORS[i] }}>{pct.toFixed(1)}%</div>
                      <div style={{ fontSize: 11, color: "#5d6b82" }}>{total}/{courseMax}</div>
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
                <div style={{ padding: "12px 18px", background: "#132a4f", color: "white", fontWeight: 700, fontSize: 13 }}>📊 Subject Breakdown</div>
                <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
                  <table className="gx-rt" style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? 12 : 13, minWidth: isMobile ? 340 : "auto" }}>
                    <thead><tr style={{ background: "#faf8f3", borderBottom: "2px solid #E5E7EB" }}>
                      <th style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700, color: "#2e3b52", fontSize: 11 }}>Subject</th>
                      <th style={{ padding: "9px 8px", textAlign: "center", fontWeight: 700, color: "#2e3b52", fontSize: 10 }}>Max</th>
                      {selected.map((st, i) => <th key={st.id} style={{ padding: "9px 10px", textAlign: "center", fontWeight: 700, color: COMPARE_COLORS[i], fontSize: isMobile ? 10 : 12 }}>{st.name.split(" ")[0]}</th>)}
                    </tr></thead>
                    <tbody>
                      {subjects.map((sub, ri) => {
                        const subMarks = selected.map(st => Number(marks[`${st.id}-${sub}`]) || 0);
                        const maxMark = Math.max(...subMarks);
                        return (
                          <tr key={sub} style={{ background: ri % 2 ? "#faf8f3" : "white", borderBottom: "1px solid #F1F5F9" }}>
                            <td style={{ padding: "8px 12px", fontWeight: 600, fontSize: isMobile ? 11 : 13 }}>{sub}</td>
                            <td style={{ padding: "8px 8px", textAlign: "center", color: "#8a93a6", fontSize: 11 }}>{subjectMaxMap[sub] || 100}</td>
                            {selected.map((st, i) => { const m = Number(marks[`${st.id}-${sub}`]) || 0; const isTop = m === maxMark && m > 0;
                              return <td key={st.id} style={{ padding: "8px 10px", textAlign: "center", fontWeight: isTop ? 800 : 500, color: isTop ? COMPARE_COLORS[i] : "#2e3b52" }}>{m}{isTop ? " 🏆" : ""}</td>; })}
                          </tr>
                        );
                      })}
                      <tr style={{ background: "#F0FDF4", borderTop: "2px solid #BBF7D0" }}>
                        <td style={{ padding: "10px 12px", fontWeight: 800, color: "#132a4f", fontSize: isMobile ? 12 : 13 }}>TOTAL</td>
                        <td style={{ padding: "10px 8px", textAlign: "center", fontWeight: 700, color: "#8a93a6" }}>{courseMax}</td>
                        {selected.map((st, i) => { const total = getTotal(st.id); const pct = getPct(total); const maxTotal = Math.max(...selected.map(s => getTotal(s.id))); const isTop = total === maxTotal;
                          return <td key={st.id} style={{ padding: "10px 10px", textAlign: "center", fontWeight: 800, color: isTop ? COMPARE_COLORS[i] : "#2e3b52", fontSize: isMobile ? 11 : 13 }}>{total} <span style={{ fontSize: 10, color: "#5d6b82" }}>({pct.toFixed(0)}%)</span>{isTop ? " 🏆" : ""}</td>; })}
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
      return <div style={{ padding: 14, textAlign: "center", color: "#8a93a6", fontSize: 12 }}>⏳ Loading marks from the database…</div>;
    }
    if (!inspectRows.length) {
      return <div style={{ padding: 14, textAlign: "center", color: "#8a93a6", fontSize: 12 }}>No mark rows exist in the database for this exam type.</div>;
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
        <div style={{ fontWeight: 700, fontSize: 11, color: "#2e3b52", textTransform: "uppercase", marginBottom: 8 }}>
          📊 {inspectRows.length} mark entr{inspectRows.length === 1 ? "y" : "ies"} found, across {dateList.length} date{dateList.length !== 1 ? "s" : ""}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
          {dateList.map(([date, info]) => (
            <div key={date} style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 4, fontSize: 11.5, padding: "5px 10px", background: "white", border: "1px solid #E5E7EB", borderRadius: 6 }}>
              <span style={{ fontWeight: 700 }}>{date}</span>
              <span style={{ color: "#5d6b82" }}>{info.students.size} student{info.students.size !== 1 ? "s" : ""} · {info.subjects.size} subject{info.subjects.size !== 1 ? "s" : ""} · {info.count} entries</span>
            </div>
          ))}
        </div>
        <div style={{ maxHeight: 240, overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: 6 }}>
          <table className="gx-rt" style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead style={{ position: "sticky", top: 0 }}>
              <tr style={{ background: "#132a4f" }}>
                {["Date", "Student", "Class", "Subject", "Marks"].map(h => (
                  <th key={h} style={{ padding: "6px 8px", textAlign: "left", color: "white", fontWeight: 700 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {inspectRows.slice(0, 200).map((r, i) => (
                <tr key={i} style={{ background: i % 2 ? "#faf8f3" : "white", borderBottom: "1px solid #F1F5F9" }}>
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
            <div style={{ padding: "6px 10px", fontSize: 10, color: "#8a93a6", textAlign: "center" }}>Showing first 200 of {inspectRows.length} rows.</div>
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
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#2e3b52", marginBottom: 18, cursor: "pointer" }}>
                    <input type="checkbox" checked={includeCrossDate} onChange={e => setIncludeCrossDate(e.target.checked)} />
                    Also remove these cross-date repeats (keeping the earliest date for each)
                  </label>
                </>
              )}

              <div style={{ display: "flex", gap: 10 }}>
                <button onClick={() => setDupPreview(null)} style={{ ...css.btn, flex: 1, background: "#f3f0e8", color: "#2e3b52" }}>Cancel</button>
                <button onClick={confirmCleanupDuplicates} disabled={dupCleaning}
                  style={{ ...css.btn, flex: 1, background: dupCleaning ? "#b7c6e0" : "#DC2626", color: "white" }}>
                  {dupCleaning ? "⏳ Removing…" : `🗑️ Delete ${dupPreview.exactGroups.reduce((s, g) => s + g.rows.length - 1, 0) + (includeCrossDate ? dupPreview.crossGroups.reduce((s, g) => s + g.rows.length - 1, 0) : 0)} Rows`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <div style={css.card}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#14213d", marginBottom: 14 }}>➕ Add Exam Type</div>
        {addError && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 12, marginBottom: 14, lineHeight: 1.5 }}>
            ⚠️ {addError}
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Name *</label>
          <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. 1st Monthly Test" style={css.input} />
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Description</label>
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
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#14213d", marginBottom: 14 }}>⚙️ Configured Exam Types</div>

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
                          <button onClick={() => toggleInspect(et.id)} style={{ ...css.btn, padding: "3px 10px", fontSize: 11, background: inspectId === et.id ? "#132a4f" : "#eef2f9", color: inspectId === et.id ? "white" : "#1e3a6e", border: inspectId === et.id ? "none" : "1px solid #BFDBFE" }}>
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
          <div key={et.id} style={{ border: "1px solid #E5E7EB", borderRadius: 8, marginBottom: 8, background: "#faf8f3", padding: "10px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{et.name}</div>
                {et.description && <div style={{ fontSize: 11, color: "#8a93a6" }}>{et.description}</div>}
                <div style={{ fontSize: 10, color: markCounts[et.id] ? "#0F6E56" : "#8a93a6", marginTop: 2 }}>
                  {markCounts[et.id] ? `${markCounts[et.id]} mark${markCounts[et.id] !== 1 ? "s" : ""} recorded` : "no marks yet"}
                </div>
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                <button onClick={() => toggleInspect(et.id)} style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: inspectId === et.id ? "#132a4f" : "#eef2f9", color: inspectId === et.id ? "white" : "#1e3a6e", border: inspectId === et.id ? "none" : "1px solid #BFDBFE" }}>
                  🔍 {inspectId === et.id ? "Hide" : "Inspect"}
                </button>
                {onSetupSchedule && (
                  <button onClick={() => onSetupSchedule(et.name)} style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: "#F0FDF4", color: "#166534", border: "1px solid #BBF7D0" }}>
                    🔗 Set up schedule
                  </button>
                )}
                <button onClick={() => autoFillSchedule(et)} disabled={autoFilling === et.id}
                  style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: autoFilling === et.id ? "#b7c6e0" : "#eef2f9", color: "#4338CA", border: "1px solid #c9d5ea" }}>
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
        {!list.length && <div style={{ color: "#8a93a6", fontSize: 13, textAlign: "center", padding: 20 }}>No exam types yet.</div>}
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
  const [, setForm]               = useState(EMPTY_FORM);
  const [, setSaved]                = useState(false);
  const [, setError]                = useState("");
  const [search, setSearch]         = useState("");
  const [filterCourse, setFilterCourse] = useState("ALL");
  const [editId, setEditId]         = useState(null);
  const [editForm, setEditForm]     = useState({});
  const [editSaving]               = useState(false);
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
  const [spellingCleanupOpen, setSpellingCleanupOpen] = useState(false); // fix variant secondary-batch spellings (e.g. "Combined Navoday ENG")

  // Existing batch values already in use (for quick-pick buttons). Track has no further
  // sub-hierarchy under it in the data — TRACK_BATCHES gives the canonical list per track,
  // but we also surface any batch values already seen in the data in case of stragglers.
  
  
  
      const cancelEdit = () => { setEditId(null); setEditForm({}); };
  const saveEdit = async () => {
    // See handleAdd note — student records are edited in StudentDB only now.
    return;
  };
  
  const confirmDelete = async () => {
    // See handleAdd note — students are removed in StudentDB only now
    // (StudentDB also distinguishes soft-delete/dropout vs. permanent
    // delete, which this screen didn't).
    setDeleteId(null);
    return;
  };
  

  const knownBatchKeys = new Set(courses.map(c => c.trim().toUpperCase()));
  const isUnrecognizedBatch = (s) => {
    const cn = (s.class_name || "").trim().toUpperCase();
    return !cn || !knownBatchKeys.has(cn);
  };
  const unrecognizedBatchCount = students.filter(isUnrecognizedBatch).length;
  const combinedCourseRawCount = students.filter(s => s.course === "Combined Course").length;

  const filtered = students.filter(s => {
    const q = search.trim().toLowerCase();
    const matchSearch = !q || (s.name || "").toLowerCase().includes(q) || String(s.gcc_no ?? "").includes(q);
    const fc = filterCourse.trim().toUpperCase();
    const matchCourse = fc === "ALL" ? true
      : fc === "__UNRECOGNIZED__" ? isUnrecognizedBatch(s)
      : fc === "__COMBINED_COURSE_RAW__" ? s.course === "Combined Course"
      : (s.class_name || "").trim().toUpperCase() === fc;
    return matchSearch && matchCourse;
  });

  const statsPerCourse = courses.map(c => ({
    course: c,
    // Uses matchesCourseBatch (not a bare class_name === check) so Combined
    // Navodaya's ENG/MAN section-tagged courseSubjects keys correctly count
    // the students whose class_name carries the section as a suffix/tag
    // instead of an exact match — see matchesCourseBatch's own comment.
    count: students.filter(s => matchesCourseBatch(s, c)).length,
    // Canonical batches only (TRACK_BATCHES), NOT batchesForTrack — that
    // helper also surfaces every distinct class_name value seen in the data,
    // including corrupted/stray ones (e.g. "???", "LAKSHYAA" with no
    // space/dash from a bad import). Mixing those into this summary card
    // made every card list batches that don't belong to it. This card is
    // just a display of "what batches make up this track", so it should
    // only ever show the real, known batch list.
    batches: TRACK_BATCHES[trackForBatch(c)] || [],
  }));

  // ── Secondary-batch stats (dual-appearing students, e.g. Combined Navodaya ENG/MM) ──
  // Built straight from secondaryBatchMap ({ studentId: [batchName, ...] }) — the real
  // source of truth for "who's also sitting another exam" — rather than from
  // courseSubjects keys, which is where the old junk "COMBINED NAVODAY ENG"/"COMBINED
  // NAVODAYA MAN" config entries came from (see matchesCourseBatch's comment). This
  // counts each distinct secondary batch value actually assigned to at least one student.
  // Variant spellings (e.g. "Combined Navoday ENG" vs the canonical "Combined Navodaya
  // Course(ENG)") are merged via normalizeSecondaryBatchSpelling so they show as ONE
  // card instead of two — see that function's comment for why the raw data can still
  // have both spellings even after this display-side merge.
  const secondaryBatchCounts = new Map();
  Object.entries(secondaryBatchMap || {}).forEach(([, batchList]) => {
    // Dedupe per student: a student with BOTH "Combined Navoday ENG" and "Combined
    // Navodaya Course(ENG)" tags (the exact spelling-drift case this normalizer
    // exists for) must only count once toward the merged ENG card, not twice.
    const canonicalTagsForStudent = new Set((batchList || []).map(normalizeSecondaryBatchSpelling));
    canonicalTagsForStudent.forEach(b => {
      secondaryBatchCounts.set(b, (secondaryBatchCounts.get(b) || 0) + 1);
    });
  });
  const statsPerSecondaryBatch = [...secondaryBatchCounts.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([batch, count]) => ({ batch, count }));

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
            <div style={{ fontSize: 13, color: "#5d6b82", textAlign: "center", marginBottom: 22 }}>
              This will permanently remove <b>{students.find(s => s.id === deleteId)?.name}</b> and all their exam marks.
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => setDeleteId(null)} style={{ ...css.btn, flex: 1, background: "#f3f0e8", color: "#2e3b52" }}>Cancel</button>
              <button onClick={confirmDelete} style={{ ...css.btn, flex: 1, background: "#DC2626", color: "white" }}>🗑️ Delete</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={() => setView("list")} style={{ ...css.btn, padding: "8px 20px", background: view === "list" ? "#132a4f" : "#f3f0e8", color: view === "list" ? "white" : "#2e3b52" }}>
          📋 All Students ({students.length})
        </button>
        {perm.canEdit && (
          <button onClick={() => { setView("add"); setError(""); setForm(EMPTY_FORM); setSaved(false); }} style={{ ...css.btn, padding: "8px 20px", background: view === "add" ? "#132a4f" : "#f3f0e8", color: view === "add" ? "white" : "#2e3b52" }}>
            👤 Add Student (via StudentDB)
          </button>
        )}
        {perm.canEdit && (
          <button onClick={() => { setView("import"); clearSelection(); }} style={{ ...css.btn, padding: "8px 20px", background: view === "import" ? "#132a4f" : "#f3f0e8", color: view === "import" ? "white" : "#2e3b52" }}>
            📥 Import from CSV / Excel
          </button>
        )}
        {perm.canEdit && (
          <button onClick={() => { setView("resultimport"); clearSelection(); }} style={{ ...css.btn, padding: "8px 20px", background: view === "resultimport" ? "#132a4f" : "#f3f0e8", color: view === "resultimport" ? "white" : "#2e3b52" }}>
            🧾 Import Result Sheet
          </button>
        )}
        {perm.canEdit && (
          <button onClick={() => { setView("secondaryimport"); clearSelection(); }} style={{ ...css.btn, padding: "8px 20px", background: view === "secondaryimport" ? "#132a4f" : "#f3f0e8", color: view === "secondaryimport" ? "white" : "#2e3b52" }}>
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
          <button onClick={() => setDupTagResolverOpen(true)} style={{ ...css.btn, padding: "8px 20px", background: "#fbf3e0", color: "#a7771f", border: "1px solid #DDD6FE" }}>
            🔀 Resolve Duplicate Section Tags
          </button>
        )}
        {perm.canEdit && (
          <button onClick={() => setSpellingCleanupOpen(true)} style={{ ...css.btn, padding: "8px 20px", background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A" }}>
            🔤 Fix Secondary Batch Spellings
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

      {spellingCleanupOpen && (
        <SecondaryBatchSpellingCleanupTool
          students={students}
          secondaryBatchMap={secondaryBatchMap}
          onSecondaryBatchesChange={onSecondaryBatchesChange}
          onClose={() => setSpellingCleanupOpen(false)}
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
            <div style={{ background: "linear-gradient(135deg,#132a4f,#1e3a6e)", padding: "18px 24px" }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, color: "white", fontWeight: 400 }}>👤 Student Records Have Moved</div>
            </div>
            <div style={{ padding: 24 }}>
              <p style={{ fontSize: 14, color: "#2e3b52", lineHeight: 1.6, marginBottom: 16 }}>
                Adding and editing students is now done in <b>StudentDB</b>, inside the Attendance module's Students tab.
                That keeps name, GCC No., course, and batch in one place instead of two screens quietly drifting apart.
              </p>
              <p style={{ fontSize: 14, color: "#2e3b52", lineHeight: 1.6, marginBottom: 20 }}>
                Once a student is added in StudentDB, they'll appear here automatically — no separate step needed.
              </p>
              <button onClick={() => { setView("list"); setError(""); }} style={{ ...css.btn, background: "#132a4f", color: "white", padding: "10px 24px" }}>
                Back to Student List
              </button>
            </div>
          </div>
        </div>
      )}

      {view === "list" && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10, marginBottom: 16 }}>
            {statsPerCourse.filter(s => s.count > 0).map(s => (
              <div key={s.course} style={{ background: "white", borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderTop: "3px solid #132a4f" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#5d6b82", textTransform: "uppercase", letterSpacing: ".08em" }}>{s.course}</div>

                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 600, color: "#132a4f", lineHeight: 1.2, marginTop: 4 }}>{s.count}</div>
                <div style={{ fontSize: 10, color: "#8a93a6", marginTop: 3 }}>{s.batches.join(", ") || "no batches"}</div>
              </div>
            ))}
            <div style={{ background: "#132a4f", borderRadius: 10, padding: "12px 14px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(255,255,255,0.6)", textTransform: "uppercase" }}>Total</div>
              <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 600, color: "white", lineHeight: 1.2, marginTop: 4 }}>{students.length}</div>
            </div>
          </div>

          {statsPerSecondaryBatch.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
                🔗 Secondary Batches (dual-appearing students)
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))", gap: 10, marginBottom: 16 }}>
                {statsPerSecondaryBatch.map(s => (
                  <div key={s.batch} style={{ background: "white", borderRadius: 10, padding: "12px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderTop: "3px solid #C9A24B" }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#92400E", textTransform: "uppercase", letterSpacing: ".08em" }}>{s.batch}</div>
                    <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 26, fontWeight: 600, color: "#132a4f", lineHeight: 1.2, marginTop: 4 }}>{s.count}</div>
                    <div style={{ fontSize: 10, color: "#8a93a6", marginTop: 3 }}>secondary batch</div>
                  </div>
                ))}
              </div>
            </>
          )}
          <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
            <input placeholder="🔍 Search by name or GCC…" value={search} onChange={e => setSearch(e.target.value)} style={{ ...css.input, flex: 1, minWidth: 180 }} />
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
              {["ALL", ...courses].map(c => (
                <button key={c} onClick={() => setFilterCourse(c)}
                  style={{ ...css.btn, padding: "5px 12px", fontSize: 11, background: filterCourse === c ? "#132a4f" : "#f3f0e8", color: filterCourse === c ? "white" : "#2e3b52", border: filterCourse === c ? "none" : "1px solid #E5E7EB" }}>
                  {c}
                </button>
              ))}
              {/* A student whose class_name doesn't match any real batch key (e.g. "???",
                  or a stray value from a bad import/edit) is otherwise invisible in this
                  filter row — there's no button for it, so staff can't find or fix it here.
                  This button surfaces exactly those students so they can be corrected in
                  StudentDB. */}
              {unrecognizedBatchCount > 0 && (
                <button onClick={() => setFilterCourse("__UNRECOGNIZED__")}
                  style={{ ...css.btn, padding: "5px 12px", fontSize: 11, background: filterCourse === "__UNRECOGNIZED__" ? "#DC2626" : "#FEF2F2", color: filterCourse === "__UNRECOGNIZED__" ? "white" : "#DC2626", border: filterCourse === "__UNRECOGNIZED__" ? "none" : "1px solid #FECACA", fontWeight: 700 }}>
                  ⚠️ Unrecognized Batch ({unrecognizedBatchCount})
                </button>
              )}
              {/* Filters by the RAW students.course value (StudentDB's real Combined Course
                  enrollment), independent of what batch key it resolved to — lets you find
                  every student StudentDB has marked "Combined Course" even if their resolved
                  class_name landed somewhere unexpected. */}
              {combinedCourseRawCount > 0 && (
                <button onClick={() => setFilterCourse("__COMBINED_COURSE_RAW__")}
                  style={{ ...css.btn, padding: "5px 12px", fontSize: 11, background: filterCourse === "__COMBINED_COURSE_RAW__" ? "#a7771f" : "#fbf3e0", color: filterCourse === "__COMBINED_COURSE_RAW__" ? "white" : "#a7771f", border: filterCourse === "__COMBINED_COURSE_RAW__" ? "none" : "1px solid #DDD6FE", fontWeight: 700 }}>
                  🔎 Raw "Combined Course" ({combinedCourseRawCount})
                </button>
              )}
            </div>
            {(search || filterCourse !== "ALL") && (
              <button onClick={() => { setSearch(""); setFilterCourse("ALL"); }}
                style={{ ...css.btn, padding: "5px 12px", fontSize: 11, background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA" }}>
                ✕ Reset filters
              </button>
            )}
          </div>

          {selectedIds.size > 0 && perm.canEdit && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: "#eef2f9", border: "1px solid #c9d5ea", borderRadius: 10, padding: "10px 14px", marginBottom: 14 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#4338CA" }}>{selectedIds.size} selected</span>
              <button onClick={() => setBulkChangeOpen(true)} style={{ ...css.btn, padding: "5px 12px", fontSize: 11, background: "#4338CA", color: "white" }}>
                🔁 Change Track / Batch
              </button>
              <button onClick={() => setBulkSecondaryOpen(true)} style={{ ...css.btn, padding: "5px 12px", fontSize: 11, background: "#a7771f", color: "white" }}>
                🔗 Add Secondary Batch
              </button>
              {perm.canDelete && (
                <button onClick={() => setBulkDeleteOpen(true)} style={{ ...css.btn, padding: "5px 12px", fontSize: 11, background: "#DC2626", color: "white" }}>
                  🗑️ Remove Selected
                </button>
              )}
              <button onClick={clearSelection} style={{ ...css.btn, padding: "5px 12px", fontSize: 11, background: "#f3f0e8", color: "#2e3b52" }}>
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
            <table className="gx-rt" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: isMobile ? 520 : "auto" }}>
              <thead>
                <tr style={{ background: "#132a4f" }}>
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
                    <td colSpan={7} style={{ padding: "28px 12px", textAlign: "center", color: "#8a93a6", fontSize: 13 }}>
                      {students.length
                        ? <>No students match your current filters. <button onClick={() => { setSearch(""); setFilterCourse("ALL"); }} style={{ color: "#132a4f", fontWeight: 700, textDecoration: "underline", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>Reset filters</button> to see all {students.length}.</>
                        : "No students loaded yet."}
                    </td>
                  </tr>
                )}
                {filtered.map((st, i) => (
                  <tr key={st.id} style={{ background: selectedIds.has(st.id) ? "#eef2f9" : (i % 2 ? "#faf8f3" : "white"), borderBottom: "1px solid #F1F5F9" }}>
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
                            <button onClick={() => saveEdit(st.id)} disabled={editSaving} style={{ ...css.btn, padding: "4px 10px", background: "#132a4f", color: "white", fontSize: 11 }}>{editSaving ? "…" : "✓"}</button>
                            <button onClick={cancelEdit} style={{ ...css.btn, padding: "4px 8px", background: "#f3f0e8", color: "#2e3b52", fontSize: 11 }}>✕</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td style={{ padding: "9px 12px", textAlign: "center", fontWeight: 700, color: "#132a4f" }}>{st.gcc_no}</td>
                        <td style={{ padding: "9px 12px", fontWeight: 600, color: "#14213d" }}>{st.name}</td>
                        <td style={{ padding: "9px 12px", textAlign: "center" }}>
                          <span style={{ background: "#eef2f9", color: "#1e3a6e", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{st.class_name || "—"}</span>
                          {(isUnrecognizedBatch(st) || st.course === "Combined Course") && (
                            // Shown when the resolved batch is unrecognized, OR when this student's
                            // real StudentDB course IS "Combined Course" — the exact case we're
                            // debugging, where the summary card showed 0 despite real students
                            // existing. Surfaces the RAW course/batch values as actually stored, so
                            // it's possible to see exactly what's in the database instead of guessing.
                            <div style={{ marginTop: 3, fontSize: 9, color: "#DC2626" }}>
                              raw: course="{st.course || "∅"}" batch="{st.batch || "∅"}"
                            </div>
                          )}
                          {(secondaryBatchMap?.[st.id] || []).map(b => (
                            <div key={b} style={{ marginTop: 3 }}>
                              <span style={{ background: "#fbf3e0", color: "#a7771f", padding: "1px 7px", borderRadius: 999, fontSize: 9.5, fontWeight: 700 }}>+ {b}</span>
                            </div>
                          ))}
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "center" }}>
                          <span style={{ background: "#E1F5EE", color: "#0F6E56", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{st.course || "—"}</span>
                        </td>
                        <td style={{ padding: "9px 12px", textAlign: "center", color: "#8a93a6", fontSize: 12 }}>{st.admission_no || "—"}</td>
                        <td style={{ padding: "9px 12px", textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 5, justifyContent: "center" }}>
                            {perm.canEdit && <button onClick={() => setSecondaryBatchStudent(st)} style={{ ...css.btn, padding: "4px 8px", background: "#fbf3e0", color: "#a7771f", border: "1px solid #DDD6FE", fontSize: 11 }} title="Manage secondary batch (e.g. also appearing for Combined Navodaya)">🔗</button>}
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {!filtered.length && (
                  <tr><td colSpan={7} style={{ padding: 32, textAlign: "center", color: "#8a93a6" }}>No students found.</td></tr>
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
        <div style={{ fontSize: 12.5, color: "#5d6b82", marginBottom: 16 }}>
          Applying to <b>{selected.length}</b> selected student{selected.length === 1 ? "" : "s"}. Leave a field blank to keep it unchanged.
        </div>
        {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>⚠️ {err}</div>}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 6, textTransform: "uppercase" }}>New Track (optional)</label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => setTrack("")} style={{ ...css.btn, padding: "5px 12px", fontSize: 12, background: track === "" ? "#132a4f" : "#f3f0e8", color: track === "" ? "white" : "#2e3b52" }}>— Keep —</button>
            {TRACKS.map(t => (
              <button key={t} onClick={() => setTrack(t)} style={{ ...css.btn, padding: "5px 12px", fontSize: 12, background: track === t ? "#132a4f" : "#f3f0e8", color: track === t ? "white" : "#2e3b52" }}>{t}</button>
            ))}
          </div>
        </div>
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 6, textTransform: "uppercase" }}>New Batch (optional)</label>
          {batchOptions.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
              {batchOptions.map(b => (
                <button key={b} onClick={() => setBatch(b)} style={{ ...css.btn, padding: "5px 12px", fontSize: 12, background: batch === b ? "#a7771f" : "#fbf3e0", color: batch === b ? "white" : "#5B21B6" }}>{b}</button>
              ))}
            </div>
          )}
          <input value={batch} onChange={e => setBatch(e.target.value)} placeholder="Leave blank to keep current batch" style={css.input} />
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ ...css.btn, flex: 1, background: "#f3f0e8", color: "#2e3b52" }}>Cancel</button>
          <button onClick={apply} disabled={saving} style={{ ...css.btn, flex: 2, background: saving ? "#b7c6e0" : "#132a4f", color: "white" }}>
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
        <label style={{ display: "flex", alignItems: "flex-start", gap: 8, background: "#faf8f3", border: "1px solid #E5E7EB", borderRadius: 10, padding: 12, marginBottom: 10, cursor: "pointer" }}>
          <input type="checkbox" checked={markDropoutInstead} onChange={e => setMarkDropoutInstead(e.target.checked)} style={{ marginTop: 2 }} />
          <span style={{ fontSize: 12.5, color: "#2e3b52" }}>
            <b>Mark as Dropout instead of deleting</b> — recommended. Keeps their name and past exam marks in history, but excludes them from active rosters, MarkEntry, and Admit Cards.
          </span>
        </label>
        {!markDropoutInstead && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#991B1B", padding: "8px 12px", borderRadius: 8, fontSize: 12, marginBottom: 10 }}>
            Permanent delete removes the student record entirely. Their exam marks may become orphaned. This cannot be undone.
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button onClick={onClose} style={{ ...css.btn, flex: 1, background: "#f3f0e8", color: "#2e3b52" }}>Cancel</button>
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
        <div style={{ fontSize: 12.5, color: "#5d6b82", marginBottom: 16 }}>
          <b>{student.name}</b> (GCC {student.gcc_no}) is on the <b>{student.class_name}</b> roster. Add a second batch below if they're
          also appearing for another exam — e.g. a Sainik-batch student who is also sitting the Combined Navodaya exam. They'll show up
          in Mark Entry, Report Cards, and Admit Cards under both batches, using this same GCC No. — no duplicate student is created.
        </div>

        {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>⚠️ {err}</div>}

        {currentSecondaryBatches.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 6, textTransform: "uppercase" }}>Current Secondary Batch(es)</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {currentSecondaryBatches.map(b => (
                <div key={b} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fbf3e0", border: "1px solid #DDD6FE", borderRadius: 8, padding: "7px 12px" }}>
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
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 6, textTransform: "uppercase" }}>Add Another Batch</label>
          <div style={{ display: "flex", gap: 8 }}>
            <select value={adding} onChange={e => setAdding(e.target.value)} style={{ ...css.input, flex: 1 }}>
              <option value="">— Select batch —</option>
              {availableBatches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <button onClick={addSecondary} disabled={!adding || saving} style={{ ...css.btn, background: saving ? "#b7c6e0" : "#a7771f", color: "white", padding: "8px 18px" }}>
              {saving ? "…" : "+ Add"}
            </button>
          </div>
          {!availableBatches.length && <div style={{ fontSize: 11.5, color: "#8a93a6", marginTop: 6 }}>No other batches available to add.</div>}
        </div>

        <button onClick={onClose} style={{ ...css.btn, width: "100%", background: "#f3f0e8", color: "#2e3b52" }}>Close</button>
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
    // Same de-dup guard as the CSV-import version of this tool: if the same
    // student was selected via two different rows/checkboxes, dedupe by
    // student_id before upserting, or Postgres rejects the whole batch with
    // "ON CONFLICT DO UPDATE command cannot affect row a second time".
    const seenIds = new Set();
    const dedupedRows = rows.filter(r => {
      if (seenIds.has(r.student_id)) return false;
      seenIds.add(r.student_id);
      return true;
    });
    const { error } = await supabase.from("student_secondary_batches").upsert(dedupedRows, { onConflict: "student_id,batch" });
    setSaving(false);
    if (error) { setErr(error.message); return; }
    setResult({ ok: true, added: toAdd.length, skipped: alreadySet });
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "white", borderRadius: 14, padding: 24, maxWidth: 480, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 600, marginBottom: 6 }}>🔗 Bulk Add Secondary Batch</div>
        <div style={{ fontSize: 12.5, color: "#5d6b82", marginBottom: 16 }}>
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
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 6, textTransform: "uppercase" }}>Secondary Batch</label>
          <select value={batch} onChange={e => setBatch(e.target.value)} style={css.input}>
            <option value="">— Select batch —</option>
            {allBatches.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} style={{ ...css.btn, flex: 1, background: "#f3f0e8", color: "#2e3b52" }}>{result ? "Close" : "Cancel"}</button>
          {!result && (
            <button onClick={apply} disabled={saving || !batch} style={{ ...css.btn, flex: 2, background: saving ? "#b7c6e0" : "#a7771f", color: "white" }}>
              {saving ? "⏳ Applying…" : `✅ Apply to ${selected.length}`}
            </button>
          )}
          {result && (
            <button onClick={onDone} style={{ ...css.btn, flex: 2, background: "#132a4f", color: "white" }}>Done</button>
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
function StudentRosterImport({ students, onDone }) {
  const isMobile = useMobile();
    const [rawRows, setRawRows] = useState(null);   // parsed sheet rows (array of arrays)
  const [headers, setHeaders] = useState([]);
  const [colMap, setColMap] = useState({ name: -1, gcc: -1, admission: -1 });
  const [defaultTrack, setDefaultTrack] = useState("");
  const [defaultBatch, setDefaultBatch] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");
  const [rows, setRows] = useState([]);           // processed rows with match info
  const [saving] = useState(false);
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
    } catch {
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
    // Roster import no longer creates students here — see StudentsTab's
    // handleAdd note. Rows marked "new" must be added in StudentDB first.
    setSaveSummary({ ok: false, message: "New students can't be created from this import anymore. Add them in StudentDB (Attendance → Students) first, then re-run this import so they match instead of appearing as \"new\"." });
    return;
  };
  
  return (
    <div style={{ maxWidth: 900 }}>
      <div style={css.card}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>📥 Smart Roster Import</div>
        <div style={{ fontSize: 12.5, color: "#5d6b82", marginBottom: 16 }}>
          Upload a CSV or Excel roster. Existing students are matched automatically (GCC No. → Admission No. → exact name → fuzzy name);
          anything unmatched can be added as new, matched manually, or skipped. You can reuse this for every future exam's roster.
        </div>

        {!rawRows && (
          <div>
            <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={parsing}
              style={{ ...css.btn, background: "#132a4f", color: "white", padding: "10px 22px" }}>
              {parsing ? "⏳ Reading file…" : "📂 Choose CSV / Excel File"}
            </button>
            {parseError && <div style={{ marginTop: 12, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5 }}>⚠️ {parseError}</div>}
          </div>
        )}

        {rawRows && !rows.length && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#5d6b82", marginBottom: 8, textTransform: "uppercase" }}>Map Columns</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[["name", "Student Name *"], ["gcc", "GCC No."], ["admission", "Admission No."]].map(([key, label]) => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 4 }}>{label}</label>
                  <select value={colMap[key]} onChange={e => setColMap(p => ({ ...p, [key]: Number(e.target.value) }))} style={css.input}>
                    <option value={-1}>— Not in file —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: "#5d6b82", marginBottom: 8, textTransform: "uppercase" }}>Default Track / Batch for New Students</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              {TRACKS.map(t => (
                <button key={t} onClick={() => setDefaultTrack(t)} style={{ ...css.btn, padding: "6px 14px", fontSize: 12, background: defaultTrack === t ? "#132a4f" : "#f3f0e8", color: defaultTrack === t ? "white" : "#2e3b52" }}>{t}</button>
              ))}
            </div>
            {defaultTrack && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
                {(TRACK_BATCHES[defaultTrack] || []).map(b => (
                  <button key={b} onClick={() => setDefaultBatch(b)} style={{ ...css.btn, padding: "5px 12px", fontSize: 12, background: defaultBatch === b ? "#a7771f" : "#fbf3e0", color: defaultBatch === b ? "white" : "#5B21B6" }}>{b}</button>
                ))}
              </div>
            )}

            {parseError && <div style={{ marginBottom: 12, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5 }}>⚠️ {parseError}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setRawRows(null); setHeaders([]); }} style={{ ...css.btn, background: "#f3f0e8", color: "#2e3b52" }}>← Back</button>
              <button onClick={processRows} style={{ ...css.btn, background: "#132a4f", color: "white", flex: 1 }}>🔎 Match {rawRows.length} Rows</button>
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
              <table className="gx-rt" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead style={{ position: "sticky", top: 0 }}>
                  <tr style={{ background: "#132a4f" }}>
                    {["Row", "Name (from file)", "Match", "Action"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "white", fontWeight: 700, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.idx} style={{ borderBottom: "1px solid #F1F5F9", background: r.status === "skip" ? "#FAFAFA" : "white" }}>
                      <td style={{ padding: "7px 10px", color: "#8a93a6" }}>{r.idx + 2}</td>
                      <td style={{ padding: "7px 10px", fontWeight: 600 }}>{r.rawName || <i style={{ color: "#DC2626" }}>{r.reason}</i>}</td>
                      <td style={{ padding: "7px 10px" }}>
                        {r.status === "existing" && (
                          <div>
                            <MatchBadge matchType={r.matchType} confidence={r.confidence} />
                            <div style={{ fontSize: 11, color: "#5d6b82", marginTop: 2 }}>{r.student?.name} · {r.student?.class_name}</div>
                          </div>
                        )}
                        {r.status === "new" && <MatchBadge matchType="New" />}
                        {r.status === "skip" && <span style={{ fontSize: 11, color: "#8a93a6" }}>Skipped</span>}
                        {r.status === "new" && r.suggestion && (
                          <div style={{ fontSize: 10.5, color: "#b8923a", marginTop: 2 }}>closest guess: {r.suggestion.name}</div>
                        )}
                      </td>
                      <td style={{ padding: "7px 10px" }}>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                          {r.status !== "new" && <button onClick={() => markAsNew(r.idx)} style={{ ...css.btn, padding: "3px 8px", fontSize: 10.5, background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0" }}>+ New</button>}
                          <button onClick={() => setManualOpenIdx(manualOpenIdx === r.idx ? null : r.idx)} style={{ ...css.btn, padding: "3px 8px", fontSize: 10.5, background: "#eef2f9", color: "#4338CA", border: "1px solid #c9d5ea" }}>🔍 Pick manually</button>
                          {r.status !== "skip" && <button onClick={() => markSkip(r.idx)} style={{ ...css.btn, padding: "3px 8px", fontSize: 10.5, background: "#f3f0e8", color: "#5d6b82" }}>Skip</button>}
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
                                    onMouseEnter={e => e.currentTarget.style.background = "#faf8f3"}
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
              <button onClick={() => { setRawRows(null); setHeaders([]); setRows([]); setSaveSummary(null); }} style={{ ...css.btn, background: "#f3f0e8", color: "#2e3b52" }}>← Start Over</button>
              <button onClick={handleSaveNew} disabled={saving || newRowsCount === 0 || gccConflicts.length > 0} style={{ ...css.btn, background: saving ? "#b7c6e0" : gccConflicts.length ? "#d9d2c2" : "#132a4f", color: "white", flex: 1 }}>
                {saving ? "⏳ Saving…" : gccConflicts.length ? "⚠️ Resolve GCC conflicts above first" : `✅ Add ${newRowsCount} New Student(s)`}
              </button>
              <button onClick={onDone} style={{ ...css.btn, background: "#f3f0e8", color: "#2e3b52" }}>Done</button>
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
    } catch {
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
    // A student can legitimately appear twice in an uploaded file (e.g. listed
    // once by name and once by GCC No. on a different row, or a genuinely
    // duplicated line) — both rows resolve to the SAME real student, so this
    // produces two identical {student_id, batch} pairs in one upsert call.
    // Postgres rejects that outright ("ON CONFLICT DO UPDATE command cannot
    // affect row a second time") since a single statement can't apply two
    // updates to the same conflict target. De-duplicating by student_id here
    // (keep the first occurrence) fixes it without silently skipping anyone —
    // it's the same student being written once, not a student being dropped.
    const seenIds = new Set();
    const dedupedRows = dbRows.filter(r => {
      if (seenIds.has(r.student_id)) return false;
      seenIds.add(r.student_id);
      return true;
    });
    const duplicateCount = dbRows.length - dedupedRows.length;
    const { error } = await supabase.from("student_secondary_batches").upsert(dedupedRows, { onConflict: "student_id,batch" });
    setSaving(false);
    if (error) { setSaveSummary({ ok: false, message: error.message }); return; }
    onChanged?.();
    setSaveSummary({ ok: true, added: dedupedRows.length, skipped: rows.length - matched.length, duplicatesInFile: duplicateCount });
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={css.card}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 600, marginBottom: 4 }}>🔗📥 Import Secondary Batch</div>
        <div style={{ fontSize: 12.5, color: "#5d6b82", marginBottom: 16 }}>
          Upload a list of existing students (by GCC No. and/or Name) and assign all of them to one secondary batch at once — e.g. a
          list of Sainik-batch students who are also appearing for the Combined Navodaya exam. This never changes their primary batch,
          GCC No., or creates a duplicate student — it only adds the extra batch tag.
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 4 }}>Secondary Batch to Assign *</label>
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
              style={{ ...css.btn, background: "#132a4f", color: "white", padding: "10px 22px" }}>
              {parsing ? "⏳ Reading file…" : "📂 Choose CSV / Excel File"}
            </button>
            {parseError && <div style={{ marginTop: 12, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5 }}>⚠️ {parseError}</div>}
          </div>
        )}

        {rawRows && !rows.length && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#5d6b82", marginBottom: 8, textTransform: "uppercase" }}>Map Columns</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[["name", "Student Name"], ["gcc", "GCC No."], ["admission", "Admission No."]].map(([key, label]) => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 4 }}>{label}</label>
                  <select value={colMap[key]} onChange={e => setColMap(p => ({ ...p, [key]: Number(e.target.value) }))} style={css.input}>
                    <option value={-1}>— Not in file —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </div>
              ))}
            </div>

            {parseError && <div style={{ marginBottom: 12, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5 }}>⚠️ {parseError}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => { setRawRows(null); setHeaders([]); }} style={{ ...css.btn, background: "#f3f0e8", color: "#2e3b52" }}>← Back</button>
              <button onClick={processRows} style={{ ...css.btn, background: "#132a4f", color: "white", flex: 1 }}>🔎 Match {rawRows.length} Rows</button>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <Badge label={`${matchedCount} matched`} color="#0F6E56" bg="#E1F5EE" />
              {unmatchedCount > 0 && <Badge label={`${unmatchedCount} unmatched`} color="#A32D2D" bg="#FCEBEB" />}
              {skipCount > 0 && <Badge label={`${skipCount} skipped`} color="#92740C" bg="#FEF9E7" />}
              {alreadyHaveBatch > 0 && <Badge label={`${alreadyHaveBatch} already in this batch`} color="#a7771f" bg="#fbf3e0" />}
            </div>

            <div style={{ maxHeight: 420, overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: 10, marginBottom: 16 }}>
              <table className="gx-rt" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead style={{ position: "sticky", top: 0 }}>
                  <tr style={{ background: "#132a4f" }}>
                    {["Row", "Name (from file)", "Match", "Action"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "white", fontWeight: 700, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.idx} style={{ borderBottom: "1px solid #F1F5F9", background: r.status === "skip" ? "#FAFAFA" : "white" }}>
                      <td style={{ padding: "7px 10px", color: "#8a93a6" }}>{r.idx + 2}</td>
                      <td style={{ padding: "7px 10px", fontWeight: 600 }}>{r.rawName || r.rawGcc || <i style={{ color: "#DC2626" }}>{r.reason}</i>}</td>
                      <td style={{ padding: "7px 10px" }}>
                        {r.status === "matched" && (
                          <div>
                            <MatchBadge matchType={r.matchType} confidence={r.confidence} />
                            <div style={{ fontSize: 11, color: "#5d6b82", marginTop: 2 }}>
                              {r.student?.name} · {r.student?.class_name}
                              {r.student?.class_name === batch && <span style={{ color: "#a7771f", fontWeight: 700 }}> (already this batch)</span>}
                            </div>
                          </div>
                        )}
                        {r.status === "unmatched" && <span style={{ fontSize: 11, color: "#A32D2D", fontWeight: 700 }}>No match found</span>}
                        {r.status === "skip" && <span style={{ fontSize: 11, color: "#8a93a6" }}>{r.reason || "Skipped"}</span>}
                        {r.status === "unmatched" && r.suggestion && (
                          <div style={{ fontSize: 10.5, color: "#b8923a", marginTop: 2 }}>closest guess: {r.suggestion.name}</div>
                        )}
                      </td>
                      <td style={{ padding: "7px 10px" }}>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                          <button onClick={() => setManualOpenIdx(manualOpenIdx === r.idx ? null : r.idx)} style={{ ...css.btn, padding: "3px 8px", fontSize: 10.5, background: "#eef2f9", color: "#4338CA", border: "1px solid #c9d5ea" }}>🔍 Pick manually</button>
                          {r.status !== "skip" && <button onClick={() => markSkip(r.idx)} style={{ ...css.btn, padding: "3px 8px", fontSize: 10.5, background: "#f3f0e8", color: "#5d6b82" }}>Skip</button>}
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
                                    onMouseEnter={e => e.currentTarget.style.background = "#faf8f3"}
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
                  ? (saveSummary.message || `✅ Added secondary batch "${batch}" to ${saveSummary.added} student(s). ${saveSummary.skipped || 0} skipped/unmatched.${saveSummary.duplicatesInFile ? ` (${saveSummary.duplicatesInFile} duplicate row(s) in the file pointed to a student already counted above, so they weren't added twice.)` : ""}`)
                  : `⚠️ ${saveSummary.message}`}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button onClick={() => { setRawRows(null); setHeaders([]); setRows([]); setSaveSummary(null); }} style={{ ...css.btn, background: "#f3f0e8", color: "#2e3b52" }}>← Start Over</button>
              <button onClick={handleImportAll} disabled={saving || !batch || matchedCount === 0} style={{ ...css.btn, background: saving ? "#b7c6e0" : "#a7771f", color: "white", flex: 1 }}>
                {saving ? "⏳ Importing…" : `✅ Assign Secondary Batch to ${matchedCount - alreadyHaveBatch} Student(s)`}
              </button>
              <button onClick={onDone} style={{ ...css.btn, background: "#f3f0e8", color: "#2e3b52" }}>Done</button>
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
    } catch {
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

    // Student records are created in StudentDB only now (see StudentsTab's
    // handleAdd note) — this importer used to silently create a student row
    // for every unmatched name, which is exactly the kind of side-door
    // creation that let this file's roster drift from StudentDB's. Any row
    // that didn't match an existing student now blocks the whole import
    // instead, so nothing gets imported half-linked to a phantom student.
    const unmatchedNewRows = rows.filter(r => r.status === "new" && r.rawName);
    if (unmatchedNewRows.length) {
      setSaveSummary({
        ok: false,
        message: `${unmatchedNewRows.length} student(s) in this file don't match anyone in the system yet (e.g. "${unmatchedNewRows[0].rawName}"). Add them in StudentDB (Attendance → Students) first, then re-run this import — Exams no longer creates student records.`,
      });
      return;
    }

    setSaving(true);
    const batchVal = batch.trim();
    const sectionSuffix = section.trim() ? ` — ${section.trim().toUpperCase()}` : "";
    const newRowsToInsert = [];
    let insertedStudents = [];


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
      // Same de-dup guard as the other secondary-batch upserts: a result
      // sheet can list the same student on two rows (e.g. matched once by
      // GCC and once by name), which would send Postgres two identical
      // {student_id, batch} pairs in one upsert and fail with "ON CONFLICT
      // DO UPDATE command cannot affect row a second time".
      const seenLinkIds = new Set();
      const dedupedLinkRows = linkRows.filter(r => {
        if (seenLinkIds.has(r.student_id)) return false;
        seenLinkIds.add(r.student_id);
        return true;
      });
      const { error } = await supabase.from("student_secondary_batches").upsert(dedupedLinkRows, { onConflict: "student_id,batch" });
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
        <div style={{ fontSize: 12.5, color: "#5d6b82", marginBottom: 16 }}>
          Upload a result sheet (Sl. No. / GCC No. / Name / subject marks / Score / Rank). This adds any new students to the permanent
          roster, tags them with a section label (e.g. ENG / MAN) for future filtering, and imports these marks as a real exam — all in
          one step. The roster is then reused automatically for every future exam of this batch.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 4 }}>Track</label>
            <select value={track} onChange={e => setTrack(e.target.value)} style={css.input}>
              {TRACKS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 4 }}>Batch</label>
            <select value={batch} onChange={e => setBatch(e.target.value)} style={css.input}>
              {courses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 4 }}>Section Tag (optional)</label>
            <input value={section} onChange={e => setSection(e.target.value)} placeholder="e.g. ENG, MAN" style={css.input} />
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 4 }}>Exam Type</label>
            <select value={examTypeId} onChange={e => setExamTypeId(e.target.value)} style={css.input}>
              {examTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 4 }}>Exam Date</label>
            <input type="date" value={examDate} onChange={e => setExamDate(e.target.value)} style={css.input} />
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 4 }}>
            Time / Shift / Room <span style={{ fontWeight: 400, textTransform: "none", color: "#8a93a6" }}>(optional — only needed if you also want Admit Cards for this sitting)</span>
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
              style={{ ...css.btn, background: "#132a4f", color: "white", padding: "10px 22px" }}>
              {parsing ? "⏳ Reading file…" : "📂 Choose Result Sheet File"}
            </button>
            {parseError && <div style={{ marginTop: 12, background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5 }}>⚠️ {parseError}</div>}
          </div>
        )}

        {rawRows && !rows.length && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#5d6b82", marginBottom: 8, textTransform: "uppercase" }}>Map Identity Columns</div>
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr 1fr", gap: 10, marginBottom: 16 }}>
              {[["name", "Student Name *"], ["gcc", "GCC No."], ["admission", "Admission No."]].map(([key, label]) => (
                <div key={key}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 4 }}>{label}</label>
                  <select value={colMap[key]} onChange={e => setColMap(p => ({ ...p, [key]: Number(e.target.value) }))} style={css.input}>
                    <option value={-1}>— Not in file —</option>
                    {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                  </select>
                </div>
              ))}
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, color: "#5d6b82", marginBottom: 8, textTransform: "uppercase" }}>Subject Columns for {batch}</div>
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
              <button onClick={() => { setRawRows(null); setHeaders([]); }} style={{ ...css.btn, background: "#f3f0e8", color: "#2e3b52" }}>← Back</button>
              <button onClick={processRows} style={{ ...css.btn, background: "#132a4f", color: "white", flex: 1 }}>🔎 Match {rawRows.length} Rows</button>
            </div>
          </div>
        )}

        {rows.length > 0 && (
          <div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
              <Badge label={`${existingCount} already on roster`} color="#0F6E56" bg="#E1F5EE" />
              <Badge label={`${newCount} new students`} color="#047857" bg="#ECFDF5" />
              {skipCount > 0 && <Badge label={`${skipCount} skipped`} color="#92740C" bg="#FEF9E7" />}
              {section.trim() && <Badge label={`Section: ${section.trim().toUpperCase()}`} color="#4338CA" bg="#eef2f9" />}
            </div>

            <div style={{ maxHeight: 420, overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: 10, marginBottom: 16 }}>
              <table className="gx-rt" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                <thead style={{ position: "sticky", top: 0 }}>
                  <tr style={{ background: "#132a4f" }}>
                    {["Row", "Name (from file)", "Match", "Marks Found", "Action"].map(h => (
                      <th key={h} style={{ padding: "8px 10px", textAlign: "left", color: "white", fontWeight: 700, fontSize: 11 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.idx} style={{ borderBottom: "1px solid #F1F5F9", background: r.status === "skip" ? "#FAFAFA" : "white" }}>
                      <td style={{ padding: "7px 10px", color: "#8a93a6" }}>{r.idx + 2}</td>
                      <td style={{ padding: "7px 10px", fontWeight: 600 }}>{r.rawName || <i style={{ color: "#DC2626" }}>{r.reason}</i>}</td>
                      <td style={{ padding: "7px 10px" }}>
                        {r.status === "existing" && (
                          <div>
                            <MatchBadge matchType={r.matchType} confidence={r.confidence} />
                            <div style={{ fontSize: 11, color: "#5d6b82", marginTop: 2 }}>{r.student?.name} · {r.student?.class_name}</div>
                          </div>
                        )}
                        {r.status === "new" && <MatchBadge matchType="New" />}
                        {r.status === "skip" && <span style={{ fontSize: 11, color: "#8a93a6" }}>{r.reason || "Skipped"}</span>}
                        {r.status === "new" && r.suggestion && (
                          <div style={{ fontSize: 10.5, color: "#b8923a", marginTop: 2 }}>closest guess: {r.suggestion.name}</div>
                        )}
                      </td>
                      <td style={{ padding: "7px 10px", color: "#5d6b82" }}>{Object.keys(r.subMarks || {}).length}/{subjects.length} subjects</td>
                      <td style={{ padding: "7px 10px" }}>
                        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                          {r.status !== "new" && <button onClick={() => markAsNew(r.idx)} style={{ ...css.btn, padding: "3px 8px", fontSize: 10.5, background: "#ECFDF5", color: "#047857", border: "1px solid #A7F3D0" }}>+ New</button>}
                          <button onClick={() => setManualOpenIdx(manualOpenIdx === r.idx ? null : r.idx)} style={{ ...css.btn, padding: "3px 8px", fontSize: 10.5, background: "#eef2f9", color: "#4338CA", border: "1px solid #c9d5ea" }}>🔍 Pick manually</button>
                          {r.status !== "skip" && <button onClick={() => markSkip(r.idx)} style={{ ...css.btn, padding: "3px 8px", fontSize: 10.5, background: "#f3f0e8", color: "#5d6b82" }}>Skip</button>}
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
                                    onMouseEnter={e => e.currentTarget.style.background = "#faf8f3"}
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
              <button onClick={() => { setRawRows(null); setHeaders([]); setRows([]); setSaveSummary(null); }} style={{ ...css.btn, background: "#f3f0e8", color: "#2e3b52" }}>← Start Over</button>
              <button onClick={handleImportAll} disabled={saving || !examTypeId || !examDate || gccConflicts.length > 0} style={{ ...css.btn, background: saving ? "#b7c6e0" : gccConflicts.length ? "#d9d2c2" : "#132a4f", color: "white", flex: 1 }}>
                {saving ? "⏳ Importing…" : gccConflicts.length ? "⚠️ Resolve GCC conflicts above first" : `✅ Import Roster + Marks (${rows.length - skipCount} students)`}
              </button>
              <button onClick={onDone} style={{ ...css.btn, background: "#f3f0e8", color: "#2e3b52" }}>Done</button>
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
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
          <button onClick={onClose} style={{ ...css.btn, padding: "4px 10px", background: "#f3f0e8", color: "#2e3b52" }}>✕</button>
        </div>
        <div style={{ fontSize: 12.5, color: "#5d6b82", marginBottom: 16 }}>
          Finds students marked absent (0 in every subject) for a given exam sitting, so they can be removed from the active roster or marked Dropout in bulk.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 4 }}>Batch / Course</label>
            <select value={course} onChange={e => setCourse(e.target.value)} style={css.input}>
              {courses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 4 }}>Exam Type</label>
            <select value={examTypeId} onChange={e => { setExamTypeId(e.target.value); setExamDate(""); }} style={css.input}>
              <option value="">— Select —</option>
              {examTypesList.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 4 }}>Exam Date (optional — leave blank to check all dates for this type)</label>
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={css.input}>
            <option value="">— All dates —</option>
            {availableDates.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        <button onClick={search} disabled={loading || !course || !examTypeId} style={{ ...css.btn, background: "#132a4f", color: "white", marginBottom: 16 }}>
          {loading ? "⏳ Searching…" : "🔎 Find Absent Students"}
        </button>

        {absentees !== null && (
          <div>
            {absentees.length === 0 ? (
              <div style={{ padding: 16, textAlign: "center", color: "#8a93a6", fontSize: 13 }}>No fully-absent students found for this sitting.</div>
            ) : (
              <>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#DC2626", marginBottom: 8 }}>{absentees.length} student(s) absent for every subject:</div>
                <div style={{ maxHeight: 260, overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: 10, marginBottom: 14 }}>
                  {absentees.map(s => (
                    <label key={s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderBottom: "1px solid #F1F5F9", fontSize: 12.5, cursor: "pointer" }}>
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSel(s.id)} />
                      <span style={{ fontWeight: 600 }}>{s.name}</span>
                      <span style={{ color: "#8a93a6" }}>GCC {s.gcc_no} · {s.class_name}</span>
                    </label>
                  ))}
                </div>
                {result && (
                  <div style={{ background: result.ok ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${result.ok ? "#BBF7D0" : "#FECACA"}`, color: result.ok ? "#166534" : "#DC2626", padding: "8px 12px", borderRadius: 8, fontSize: 12.5, marginBottom: 12 }}>
                    {result.ok ? "✅ " : "⚠️ "}{result.message}
                  </div>
                )}
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button onClick={() => applyAction("dropout")} disabled={applying || !selected.size} style={{ ...css.btn, background: applying ? "#b7c6e0" : "#B45309", color: "white" }}>
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
function BatchSuffixCleanupTool({ students, secondaryBatchMap, onSecondaryBatchesChange, onClose }) {
  const [scanning, setScanning] = useState(true);
  const [affected, setAffected] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);



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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
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
      // Batch is a core student field now — restoring it here would be
      // exactly the kind of direct students.batch write we removed
      // elsewhere. Only the secondary-batch tag (exam-only metadata) gets
      // fixed automatically; the real batch itself must be corrected in
      // StudentDB.

      // Remove any WRONG "Combined Navodaya Course..." secondary tag the
      // bug applied (e.g. tagged "(MM)" when the student is actually ENG).
      for (const wrongBatch of s._wrongSecondaryBatches) {
        const { error } = await supabase.from("student_secondary_batches").delete().eq("student_id", s.id).eq("batch", wrongBatch);
        if (error) errors.push(`${s.name} (removing "${wrongBatch}"): ${error.message}`);
      }

      // Add the CORRECT secondary batch based on the suffix that was
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
      setResult({ ok: true, message: `Tagged ${toFix.length} student(s) with the correct section (ENG/MM). Their Batch field still shows the "— ENG"/"— MM" suffix — please strip that in StudentDB (Attendance → Students) to fully clean it up, since Exams no longer edits students.batch directly.` });
    }
    setAffected(prev => prev.filter(s => !selected.has(s.id) || false));
    // Batch itself is untouched here, so re-run the scan next time this
    // modal opens rather than optimistically clearing fixed rows — they'll
    // keep showing up until StudentDB corrects the suffix, which is the
    // point (it's a visible reminder the batch field itself still needs fixing).
    setSelected(new Set());
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto" }}>
      <div style={{ background: "white", borderRadius: 14, padding: 24, maxWidth: 680, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", marginTop: 30 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 600 }}>🧹 Fix Corrupted Batch Suffixes</div>
          <button onClick={onClose} style={{ ...css.btn, padding: "4px 10px", background: "#f3f0e8", color: "#2e3b52" }}>✕</button>
        </div>
        <div style={{ fontSize: 12.5, color: "#5d6b82", marginBottom: 16 }}>
          Finds students whose Batch shows a stray suffix like "Achiever — ENG" from an earlier import bug. For each one, this
          removes any wrong "Combined Navodaya Course..." tag the bug applied and adds the <b>correct</b> one based on their
          actual section — ENG → <code>Combined Navodaya Course(ENG)</code>, MM → <code>Combined Navodaya Course (MM)</code>.
          The Batch field itself (e.g. restoring "Achiever — ENG" to "Achiever") must be corrected in StudentDB
          (Attendance → Students) — Exams no longer edits student records directly.
        </div>

        {scanning ? (
          <div style={{ padding: 24, textAlign: "center", color: "#8a93a6" }}>Scanning…</div>
        ) : affected.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: "#0F6E56", fontWeight: 600 }}>✅ No corrupted batch suffixes found. Nothing to fix.</div>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button onClick={selectAll} style={{ ...css.btn, padding: "5px 10px", fontSize: 11, background: "#eef2f9", color: "#1e3a6e" }}>Select All</button>
              <button onClick={deselectAll} style={{ ...css.btn, padding: "5px 10px", fontSize: 11, background: "#FEF2F2", color: "#DC2626" }}>Deselect All</button>
              <div style={{ fontSize: 12, color: "#8a93a6", alignSelf: "center" }}>{affected.length} affected</div>
            </div>
            <div style={{ maxHeight: 380, overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: 10, marginBottom: 14 }}>
              {affected.map(s => (
                <label key={s.id} style={{ display: "flex", flexDirection: "column", gap: 4, padding: "8px 12px", borderBottom: "1px solid #F1F5F9", fontSize: 12.5, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSel(s.id)} />
                    <span style={{ fontWeight: 600, flex: 1 }}>{s.name}</span>
                    <span style={{ color: "#8a93a6" }}>GCC {s.gcc_no}</span>
                    <span style={{ background: "#FEF2F2", color: "#DC2626", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{s.batch}</span>
                    <span style={{ color: "#8a93a6" }}>→</span>
                    <span style={{ background: "#E1F5EE", color: "#0F6E56", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{s._restoredBatch}</span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", paddingLeft: 24 }}>
                    {s._wrongSecondaryBatches.map(b => (
                      <span key={b} style={{ fontSize: 10.5, background: "#FEF2F2", color: "#DC2626", padding: "1px 7px", borderRadius: 999, textDecoration: "line-through" }}>{b}</span>
                    ))}
                    {s._correctSecondaryBatch && (
                      <span style={{ fontSize: 10.5, background: s._alreadyHasCorrectTag ? "#fbf3e0" : "#ECFDF5", color: s._alreadyHasCorrectTag ? "#a7771f" : "#047857", padding: "1px 7px", borderRadius: 999, fontWeight: 700 }}>
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
            <button onClick={applyFix} disabled={applying || !selected.size} style={{ ...css.btn, background: applying ? "#b7c6e0" : "#132a4f", color: "white", width: "100%" }}>
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
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
          <button onClick={onClose} style={{ ...css.btn, padding: "4px 10px", background: "#f3f0e8", color: "#2e3b52" }}>✕</button>
        </div>
        <div style={{ fontSize: 12.5, color: "#5d6b82", marginBottom: 16 }}>
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
              <span style={{ fontSize: 12, fontWeight: 700, color: "#2e3b52" }}>Bulk resolve {remaining.length - excluded.size} of {remaining.length}:</span>
              <button onClick={() => bulkResolve(ENG)} disabled={resolving !== null}
                style={{ ...css.btn, padding: "6px 14px", fontSize: 12, background: "#1e3a6e", color: "white" }}>
                {resolving === "bulk" ? "⏳ Working…" : "Keep ENG for All"}
              </button>
              <button onClick={() => bulkResolve(MM)} disabled={resolving !== null}
                style={{ ...css.btn, padding: "6px 14px", fontSize: 12, background: "#a7771f", color: "white" }}>
                {resolving === "bulk" ? "⏳ Working…" : "Keep MM for All"}
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 380, overflowY: "auto" }}>
              {remaining.map(s => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", border: "1px solid #E5E7EB", borderRadius: 10, background: excluded.has(s.id) ? "#FFFBEB" : "#faf8f3" }}>
                  <input type="checkbox" checked={!excluded.has(s.id)} onChange={() => toggleExclude(s.id)} title="Uncheck to exclude from bulk actions" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</div>
                    <div style={{ fontSize: 11, color: "#8a93a6" }}>GCC {s.gcc_no ?? "—"} · real batch: {s.class_name || "—"}</div>
                  </div>
                  <button onClick={() => resolve(s, ENG)} disabled={resolving !== null}
                    style={{ ...css.btn, padding: "6px 14px", fontSize: 12, background: "#eef2f9", color: "#1e3a6e", border: "1px solid #BFDBFE" }}>
                    {resolving === s.id ? "…" : "Keep ENG"}
                  </button>
                  <button onClick={() => resolve(s, MM)} disabled={resolving !== null}
                    style={{ ...css.btn, padding: "6px 14px", fontSize: 12, background: "#fbf3e0", color: "#a7771f", border: "1px solid #DDD6FE" }}>
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

// ─── FIX SECONDARY BATCH SPELLINGS (variant spellings → canonical) ────────────
// Some student_secondary_batches rows use an older/variant spelling of the
// Combined Navodaya section tags (e.g. "Combined Navoday ENG" — missing the
// "a" and shaped differently) instead of the canonical strings used
// everywhere else in this file: "Combined Navodaya Course(ENG)" and "Combined
// Navodaya Course (MM)" (see normalizeSecondaryBatchSpelling's comment). The
// display-side normalizer merges these for stats cards and the secondary-
// batch filter dropdowns, but the underlying rows are still split across two
// spellings — this tool actually rewrites them to the canonical form so
// there's only ever one real tag per student going forward.
function SecondaryBatchSpellingCleanupTool({ students, secondaryBatchMap, onSecondaryBatchesChange, onClose }) {
  const [scanning, setScanning] = useState(true);
  const [affected, setAffected] = useState([]); // [{ student, rawBatch, canonicalBatch, alreadyHasCanonical }]
  const [selected, setSelected] = useState(new Set());
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    const found = [];
    Object.entries(secondaryBatchMap || {}).forEach(([studentId, batchList]) => {
      (batchList || []).forEach(raw => {
        const canonical = normalizeSecondaryBatchSpelling(raw);
        // Only variant spellings that actually differ from their canonical
        // form need fixing — an already-canonical tag or an unrelated batch
        // value (normalizeSecondaryBatchSpelling returns it unchanged) is left alone.
        if (canonical !== raw && (canonical === CANONICAL_ENG_TAG || canonical === CANONICAL_MM_TAG)) {
          const student = students.find(s => String(s.id) === String(studentId));
          if (!student) return; // stale row pointing at a deleted student
          found.push({
            student,
            rawBatch: raw,
            canonicalBatch: canonical,
            // If the student ALREADY has the canonical tag too, this is a pure
            // duplicate-spelling case — fixing it means just deleting the
            // variant row, not upserting (which would be a no-op anyway, but
            // this makes the affected-row summary accurate).
            alreadyHasCanonical: (batchList || []).includes(canonical),
          });
        }
      });
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
    setAffected(found);
    setSelected(new Set(found.map((f, i) => i)));
    setScanning(false);
  }, [students, secondaryBatchMap]);

  const toggleSel = (i) => setSelected(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  const selectAll = () => setSelected(new Set(affected.map((_, i) => i)));
  const deselectAll = () => setSelected(new Set());

  const applyFix = async () => {
    if (!selected.size) return;
    setApplying(true);
    setResult(null);
    const toFix = affected.filter((_, i) => selected.has(i));
    const errors = [];

    for (const f of toFix) {
      // Always remove the variant-spelling row first.
      const { error: delErr } = await supabase.from("student_secondary_batches")
        .delete().eq("student_id", f.student.id).eq("batch", f.rawBatch);
      if (delErr) { errors.push(`${f.student.name} (removing "${f.rawBatch}"): ${delErr.message}`); continue; }

      // Only add the canonical row if the student doesn't already have it —
      // otherwise this would just be recreating a duplicate we didn't need to touch.
      if (!f.alreadyHasCanonical) {
        const { error: upErr } = await supabase.from("student_secondary_batches")
          .upsert([{ student_id: f.student.id, batch: f.canonicalBatch }], { onConflict: "student_id,batch" });
        if (upErr) errors.push(`${f.student.name} (adding "${f.canonicalBatch}"): ${upErr.message}`);
      }
    }

    setApplying(false);
    onSecondaryBatchesChange?.();
    if (errors.length) {
      setResult({ ok: false, message: `${toFix.length - errors.length} fixed, ${errors.length} failed: ${errors[0]}${errors.length > 1 ? ` (+${errors.length - 1} more)` : ""}` });
    } else {
      setResult({ ok: true, message: `Fixed ${toFix.length} row(s) — all now use the canonical spelling.` });
    }
    setSelected(new Set());
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 20, overflowY: "auto" }}>
      <div style={{ background: "white", borderRadius: 14, padding: 24, maxWidth: 700, width: "100%", boxShadow: "0 8px 40px rgba(0,0,0,0.18)", marginTop: 30 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 17, fontWeight: 600 }}>🔤 Fix Secondary Batch Spellings</div>
          <button onClick={onClose} style={{ ...css.btn, padding: "4px 10px", background: "#f3f0e8", color: "#2e3b52" }}>✕</button>
        </div>
        <div style={{ fontSize: 12.5, color: "#5d6b82", marginBottom: 16 }}>
          These students have a secondary-batch tag using an older or variant spelling (e.g. "Combined Navoday ENG") instead of
          the canonical form ("Combined Navodaya Course(ENG)" / "Combined Navodaya Course (MM)"). Stats cards and print filters
          already merge these for display, but fixing the underlying tag here means Report Cards / Admit Cards / Bulk Reports
          will find everyone under a single, correct secondary-batch selection going forward.
        </div>

        {scanning && <div style={{ padding: 24, textAlign: "center", color: "#5d6b82" }}>Scanning…</div>}

        {!scanning && result && (
          <div style={{ background: result.ok ? "#F0FDF4" : "#FEF2F2", border: `1px solid ${result.ok ? "#BBF7D0" : "#FECACA"}`, color: result.ok ? "#166534" : "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 12.5, marginBottom: 14 }}>
            {result.ok ? "✅ " : "⚠️ "}{result.message}
          </div>
        )}

        {!scanning && affected.length === 0 && !result && (
          <div style={{ padding: 24, textAlign: "center", color: "#0F6E56", fontWeight: 600 }}>
            ✅ No variant spellings found. Every secondary batch tag already uses the canonical form.
          </div>
        )}

        {!scanning && affected.length > 0 && (
          <>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center" }}>
              <button onClick={selectAll} style={{ ...css.btn, padding: "5px 12px", fontSize: 11.5, background: "#f3f0e8", color: "#2e3b52" }}>Select All</button>
              <button onClick={deselectAll} style={{ ...css.btn, padding: "5px 12px", fontSize: 11.5, background: "#f3f0e8", color: "#2e3b52" }}>Deselect All</button>
              <span style={{ fontSize: 12, color: "#5d6b82", marginLeft: "auto" }}>{selected.size} of {affected.length} selected</span>
            </div>
            <div style={{ maxHeight: 320, overflowY: "auto", border: "1px solid #E5E7EB", borderRadius: 8, marginBottom: 16 }}>
              {affected.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderBottom: i < affected.length - 1 ? "1px solid #F1F5F9" : "none", fontSize: 12.5 }}>
                  <input type="checkbox" checked={selected.has(i)} onChange={() => toggleSel(i)} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600 }}>{f.student.name} <span style={{ color: "#8a93a6", fontWeight: 400 }}>({f.student.gcc_no})</span></div>
                    <div style={{ color: "#92400E", fontSize: 11.5, marginTop: 2 }}>
                      "{f.rawBatch}" → "{f.canonicalBatch}"{f.alreadyHasCanonical && <span style={{ color: "#DC2626" }}> — already has canonical tag; variant will just be removed</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={{ ...css.btn, background: "#f3f0e8", color: "#2e3b52", padding: "9px 18px" }}>Close</button>
              <button onClick={applyFix} disabled={applying || !selected.size} style={{ ...css.btn, background: "#132a4f", color: "white", padding: "9px 18px" }}>
                {applying ? "⏳ Fixing…" : `Fix ${selected.size} Selected`}
              </button>
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
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
  // dense rank by total (ties share a rank) — plain loop, no outer variables mutated
  const rankedWithRanks = (() => {
    let cr = 1, pt = null;
    const out = [];
    for (let i = 0; i < ranked.length; i++) {
      const st = ranked[i];
      if (i === 0) { cr = 1; pt = st.total; } else if (st.total !== pt) { cr++; pt = st.total; }
      out.push({ ...st, rank: cr });
    }
    return out;
  })();
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
      <div style={{ ...css.card, background: "#faf8f3", marginBottom: 14 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setMarks({}); }} />
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 180 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select>
        </div>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Date</label>
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 160 }}>{dates.map(d => <option key={d} value={d}>{d}</option>)}</select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Top Rank</label>
          <select value={rankFilter} onChange={e => setRankFilter(e.target.value)} style={{ ...css.input, width: 110 }}>
            <option value="">All</option><option value="3">Top 3</option><option value="5">Top 5</option><option value="10">Top 10</option><option value="20">Top 20</option>
          </select>
        </div>
        <button onClick={handlePrint} style={{ ...css.btn, background: "#132a4f", color: "white" }}>🖨️ Print</button>
      </div>
      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", background: "#132a4f", color: "white", fontWeight: 700, fontSize: 13 }}>📜 Merit List — {course} ({filtered.length} students)</div>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table className="gx-rt" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: isMobile ? 380 : "auto" }}>
            <thead><tr style={{ background: "#faf8f3", borderBottom: "2px solid #E5E7EB" }}>
              {["Rank", "Student", "GCC No", "Total", "%", "Grade"].map(h => <th key={h} style={{ padding: "10px 12px", textAlign: h === "Student" ? "left" : "center", fontWeight: 700, color: "#2e3b52", fontSize: 11 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {filtered.map((st, i) => {
                const grade = getGrade(st.pct);
                return (
                  <tr key={st.id} style={{ background: i % 2 ? "#faf8f3" : "white", borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800, fontSize: i < 3 ? 15 : 12, color: i < 3 ? "#D97706" : "#2e3b52" }}>{i < 3 ? medals[i] : ""} {st.rank}</td>
                    <td style={{ padding: "10px 12px", fontWeight: 600, fontSize: isMobile ? 12 : 13 }}>{st.name}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center", color: "#5d6b82" }}>{st.gcc_no || "—"}</td>
                    <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800 }}>{st.total}<span style={{ fontSize: 10, color: "#8a93a6" }}>/{courseMax}</span></td>
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
        } catch {
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
        <div style={{ fontSize: 12.5, color: "#5d6b82", marginBottom: 16 }}>
          This renames <b>"{oldName}"</b> everywhere — every student assigned to it, every schedule entry, every exam mark record,
          every secondary-batch tag, and any saved Exam Config presets that reference it. This cannot be easily undone; the old name
          will no longer exist anywhere in the app afterward.
        </div>

        {affectedCounts && (
          <div style={{ background: "#faf8f3", border: "1px solid #E5E7EB", borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 12.5 }}>
            <div style={{ fontWeight: 700, color: "#2e3b52", marginBottom: 6 }}>This will affect:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              <Badge label={`${affectedCounts.students} student(s)`} color="#1e3a6e" bg="#eef2f9" />
              <Badge label={`${affectedCounts.schedule} schedule entr${affectedCounts.schedule === 1 ? "y" : "ies"}`} color="#0F6E56" bg="#E1F5EE" />
              <Badge label={`${affectedCounts.marks} mark record(s)`} color="#92740C" bg="#FEF9E7" />
              {affectedCounts.secondary > 0 && <Badge label={`${affectedCounts.secondary} secondary-batch tag(s)`} color="#a7771f" bg="#fbf3e0" />}
            </div>
          </div>
        )}

        {err && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 12.5, marginBottom: 14 }}>⚠️ {err}</div>}

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 6, textTransform: "uppercase" }}>New Name</label>
          <input value={newName} onChange={e => setNewName(e.target.value)} style={css.input} disabled={saving} autoFocus />
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onClose} disabled={saving} style={{ ...css.btn, flex: 1, background: "#f3f0e8", color: "#2e3b52" }}>Cancel</button>
          <button onClick={rename} disabled={saving || !newName.trim() || newName.trim() === oldName}
            style={{ ...css.btn, flex: 2, background: saving ? "#b7c6e0" : "#DC2626", color: "white" }}>
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
  const [deletingCourse, setDeletingCourse] = useState(null); // course name pending delete confirmation
  const [deleting, setDeleting] = useState(false);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
  useEffect(() => { setList(courseSubjects[selected] || []); }, [selected, courseSubjects]);

  const save = async () => {
    setSaving(true);
    const updated = { ...courseSubjects, [selected]: list };
    await supabase.from("system_settings").upsert({ key: "course_subjects", value: JSON.stringify(updated) }, { onConflict: "key" });
    onUpdate(updated); setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  // Removes a course/batch KEY from the saved courseSubjects config only —
  // this is for cleaning up stray/corrupted config entries (e.g. junk
  // "COMBINED NAVODAY ENG" keys from a bad import) that never correspond to
  // a real courseSubjects.<key> naming convention. This does NOT touch any
  // student record — a student's class_name field lives in `students` and is
  // untouched by this. If students still have a class_name matching the
  // deleted key, they'll just show under "Unrecognized Batch" elsewhere in
  // the app until their class_name is corrected in StudentDB.
  const deleteCourse = async (name) => {
    setDeleting(true);
    const updated = { ...courseSubjects };
    delete updated[name];
    await supabase.from("system_settings").upsert({ key: "course_subjects", value: JSON.stringify(updated) }, { onConflict: "key" });
    onUpdate(updated);
    setDeleting(false);
    setDeletingCourse(null);
    if (selected === name) setSelected(Object.keys(updated)[0] || "");
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
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 17, color: "#14213d", marginBottom: 16 }}>📚 Subjects per Course / Batch</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 18, flexWrap: "wrap" }}>
          {Object.keys(courseSubjects).map(c => (
            <div key={c} style={{ display: "flex", alignItems: "stretch" }}>
              <button onClick={() => setSelected(c)}
                style={{ ...css.btn, padding: "6px 16px", background: selected === c ? "#132a4f" : "#f3f0e8", color: selected === c ? "white" : "#2e3b52", border: "1.5px solid " + (selected === c ? "#132a4f" : "#e8e3d8"), borderRadius: "8px 0 0 8px" }}>
                {c} <span style={{ fontSize: 11, opacity: 0.7 }}>({(courseSubjects[c] || []).length})</span>
              </button>
              <button onClick={() => setRenamingCourse(c)} title={`Rename "${c}" everywhere (students, schedule, marks, configs)`}
                style={{ ...css.btn, padding: "6px 10px", background: selected === c ? "#14532d" : "#e8e3d8", color: selected === c ? "white" : "#5d6b82", border: "1.5px solid " + (selected === c ? "#132a4f" : "#e8e3d8"), borderLeft: "none", fontSize: 12 }}>
                ✏️
              </button>
              <button onClick={() => setDeletingCourse(c)} title={`Remove "${c}" from Course Subjects config (does not touch student records)`}
                style={{ ...css.btn, padding: "6px 10px", background: selected === c ? "#7f1d1d" : "#FEE2E2", color: selected === c ? "white" : "#B91C1C", border: "1.5px solid " + (selected === c ? "#132a4f" : "#e8e3d8"), borderLeft: "none", borderRadius: "0 8px 8px 0", fontSize: 12 }}>
                🗑️
              </button>
            </div>
          ))}
          <div style={{ display: "flex", gap: 6 }}>
            <input value={newCourse} onChange={e => setNewCourse(e.target.value)} placeholder="New course…" style={{ ...css.input, width: 120, fontSize: 12 }}
              onKeyDown={e => { if (e.key === "Enter") addCourse(); }} />
            <button onClick={addCourse} style={{ ...css.btn, padding: "6px 12px", background: "#eef2f9", color: "#1e3a6e", fontSize: 12 }}>+ Add</button>
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
        {deletingCourse && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: "white", borderRadius: 12, padding: 24, maxWidth: 420, boxShadow: "0 8px 30px rgba(0,0,0,0.2)" }}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, marginBottom: 10 }}>Remove "{deletingCourse}"?</div>
              <p style={{ fontSize: 13, color: "#4b5870", lineHeight: 1.6, marginBottom: 16 }}>
                This removes the course/batch key and its subject list from the saved config. It does <b>not</b> delete or move any student —
                if any student's class_name still matches "{deletingCourse}" exactly, they'll show up as an Unrecognized Batch until corrected in StudentDB.
              </p>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={() => setDeletingCourse(null)} style={{ ...css.btn, background: "#f3f0e8", color: "#2e3b52" }}>Cancel</button>
                <button onClick={() => deleteCourse(deletingCourse)} disabled={deleting} style={{ ...css.btn, background: "#B91C1C", color: "white" }}>
                  {deleting ? "Removing…" : "Remove Course"}
                </button>
              </div>
            </div>
          </div>
        )}
        {selected && (
          <>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#5d6b82", textTransform: "uppercase", marginBottom: 8 }}>
              Subjects for <span style={{ color: "#132a4f" }}>{selected}</span>
              <span style={{ marginLeft: 8, fontWeight: 400, color: "#8a93a6" }}>(Max: {getCourseMax(selected)})</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {list.map((sub, i) => (
                <span key={sub} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", background: "#eef2f9", border: "1px solid #c9d5ea", borderRadius: 999, fontSize: 13, color: "#1e3a6e" }}>
                  <span style={{ fontSize: 10, color: "#8a93a6", fontWeight: 700 }}>{i + 1}.</span>
                  {sub}
                  <span style={{ fontSize: 10, color: "#b7c6e0", fontWeight: 600 }}>/{getSubjectMax(selected, sub)}</span>
                  <span onClick={() => setList(p => p.filter(s => s !== sub))} style={{ cursor: "pointer", color: "#b7c6e0", fontWeight: 800, fontSize: 15 }}>×</span>
                </span>
              ))}
              {!list.length && <span style={{ color: "#d9d2c2", fontSize: 13 }}>No subjects added yet.</span>}
            </div>
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <input value={newSub} onChange={e => setNew(e.target.value)} placeholder="Add subject name…" style={{ ...css.input, flex: 1 }}
                onKeyDown={e => { if (e.key === "Enter" && newSub.trim()) { setList(p => [...p, newSub.trim()]); setNew(""); } }} />
              <button onClick={() => { if (newSub.trim()) { setList(p => [...p, newSub.trim()]); setNew(""); } }} style={{ ...css.btn, background: "#1e3a6e", color: "white" }}>Add</button>
            </div>
            <SaveBtn onClick={save} saving={saving} saved={saved} label={`Save ${selected} Subjects`} />
          </>
        )}
      </div>
      <div style={{ ...css.card, background: "#faf8f3" }}>
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 15, color: "#14213d", marginBottom: 12 }}>📋 All Courses Summary</div>
        {Object.entries(courseSubjects).map(([c, subs]) => (
          <div key={c} style={{ marginBottom: 10, padding: "10px 14px", background: "white", borderRadius: 8, border: "1px solid #E5E7EB" }}>
            <div style={{ fontWeight: 700, color: "#132a4f", fontSize: 13, marginBottom: 4 }}>
              {c} <span style={{ color: "#8a93a6", fontWeight: 400 }}>({subs.length} subjects · max {getCourseMax(c)} marks)</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {subs.map(s => (
                <span key={s} style={{ fontSize: 11, padding: "2px 8px", background: "#f3f0e8", borderRadius: 999, color: "#4b5870" }}>
                  {s} <span style={{ color: "#8a93a6" }}>/{getSubjectMax(c, s)}</span>
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
        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 18, color: "#14213d", marginBottom: 16 }}>🏛️ Institute Information</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))", gap: 14 }}>
          {[
            { label: "Institute Name", key: "name" }, { label: "Address", key: "address" },
            { label: "Tagline", key: "tagline" }, { label: "Principal Name", key: "principal" },
            { label: "Class Teacher", key: "teacher" }, { label: "Logo URL", key: "logoUrl" },
            { label: "Academic Year", key: "academicYear" },
          ].map(f => (
            <div key={f.key}>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>{f.label}</label>
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
function Schedule({ courseSubjects, examTypes, onScheduleChange, activeExamConfig }) {
  const isMobile = useMobile();
  const courses = Object.keys(courseSubjects);
  const [schedule, setSchedule] = useState([]);
  const [, setLoading] = useState(true);
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

  // ── Auto-Generate Schedule from the ACTIVE Exam Config ────────────────────
  // Unlike the single-batch "Generate" tool above (genCourse/genPreview),
  // this builds a schedule for EVERY batch in the currently active config in
  // one pass — the config already defines each batch's subject list and max
  // marks, so the only new input needed is which exam type + starting date
  // this run of the schedule is for.
  const [acExamType, setAcExamType] = useState(examTypes[0]?.id || "");
  const [acStartDate, setAcStartDate] = useState("");
  const [acTime, setAcTime] = useState("09:00");
  const [acShift, setAcShift] = useState("Morning");
  const [acRoom, setAcRoom] = useState("");
  const [acSkipWeekends, setAcSkipWeekends] = useState(true);
  const [acSameDateAllBatches, setAcSameDateAllBatches] = useState(true);
  const [acSaving, setAcSaving] = useState(false);
  const [acSaved, setAcSaved] = useState(false);
  const [acError, setAcError] = useState("");

  const acConfigBatches = activeExamConfig?.courseSubjects
    ? Object.keys(activeExamConfig.courseSubjects)
    : [];
  const acConfigBatchesKey = acConfigBatches.join("|");

  // Builds the full preview: for each batch in the active config, one row
  // per subject, dated sequentially. `acSameDateAllBatches` controls whether
  // every batch's Subject 1 lands on the same start date (typical when all
  // batches sit the same exam on the same day, just different subjects per
  // session) or whether each batch's subjects continue sequentially from
  // where the PREVIOUS batch's subjects left off (for a single shared
  // timetable that runs one batch after another).
  const acPreview = React.useMemo(() => {
    if (!acStartDate || !acConfigBatches.length) return [];
    const advance = (d) => {
      d.setDate(d.getDate() + 1);
      if (acSkipWeekends) while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
    };
    const rows = [];
    let sharedDate = new Date(acStartDate);
    if (acSkipWeekends) while (sharedDate.getDay() === 0 || sharedDate.getDay() === 6) sharedDate.setDate(sharedDate.getDate() + 1);

    for (const course of acConfigBatches) {
      const subjects = activeExamConfig.courseSubjects[course] || [];
      const maxMap = activeExamConfig.courseMaxMarks?.[course] || {};
      let d = acSameDateAllBatches ? new Date(sharedDate) : new Date(sharedDate);
      subjects.forEach((subject) => {
        rows.push({
          course, subject,
          exam_date: d.toISOString().split("T")[0],
          total_marks: maxMap[subject] || getSubjectMax(course, subject),
        });
        advance(d);
      });
      // Only advance the shared starting point across batches when batches
      // are meant to continue one after another; if every batch starts on
      // the same date, sharedDate never moves between batches.
      if (!acSameDateAllBatches) sharedDate = d;
    }
    return rows;
  }, [acStartDate, acConfigBatchesKey, acSameDateAllBatches, acSkipWeekends, activeExamConfig]);

  // Rows that would collide with a schedule entry that already exists for
  // this exam type — re-running Auto-Generate (e.g. after fixing a date)
  // must never create duplicate exam_schedule rows for the same
  // (exam_type, course, subject).
  const acExistingKeys = new Set(
    schedule.filter(s => s.exam_type_id === acExamType).map(s => `${s.course}|${s.subject}`)
  );
  const acNewRows = acPreview.filter(r => !acExistingKeys.has(`${r.course}|${r.subject}`));
  const acSkippedCount = acPreview.length - acNewRows.length;

  const handleSaveAutoGenerate = async () => {
    if (!activeExamConfig) { setAcError("No active exam config found — set one as active in Exam Config first."); return; }
    if (!acExamType) { setAcError("Pick an exam type."); return; }
    if (!acNewRows.length) { setAcError(acSkippedCount ? "Every subject in this config already has a schedule entry for this exam type." : "Pick a start date."); return; }
    setAcError("");
    setAcSaving(true);
    const rows = acNewRows.map(r => ({
      exam_type_id: acExamType, course: r.course, subject: r.subject,
      exam_date: r.exam_date, time: acTime, shift: acShift, room: acRoom,
      total_marks: Number(r.total_marks) || 100,
    }));
    const { error } = await supabase.from("exam_schedule").insert(rows);
    setAcSaving(false);
    if (error) { setAcError(error.message); return; }
    setAcSaved(true); fetchSchedule(); onScheduleChange?.();
    setTimeout(() => setAcSaved(false), 2500);
  };

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
        // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
        setMsRows(subs.map((subject) => ({ subject, date: "", marks: maxMap[subject] || getSubjectMax(msCourse, subject) })));
        return;
      }
    }
    const subs = courseSubjects[msCourse] || [];
    setMsRows(subs.map((subject) => ({ subject, date: "", marks: getSubjectMax(msCourse, subject) })));
  }, [msCourse]);

  useEffect(() => {
    if (!msStartDate) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
    setGenSubjectOrder(subs.map(s => ({ subject: s, marks: getSubjectMax(genCourse, s) })));
    setGenPreview([]);
  }, [genCourse]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
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
    const rows = toDup.map((r) => ({ ...Object.fromEntries(Object.entries(r).filter(([k]) => k !== "id" && k !== "created_at")), exam_date: dupDate }));
    await supabase.from("exam_schedule").insert(rows);
    setDupSaving(false); setDupSaved(true); setDupIds(new Set()); fetchSchedule(); onScheduleChange?.();
    setTimeout(() => setDupSaved(false), 2500);
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]; if (!file) return; e.target.value = "";
    await ensureLibs(); const XLSX = window.XLSX;
    let rows;
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
        <span style={{ fontSize: 11, fontWeight: 700, color: "#5d6b82", textTransform: "uppercase", marginRight: 4 }}>Mode:</span>
        <ModeBtn mode={mode} setMode={setMode} isMobile={isMobile} id="single"    icon="✏️"  label="Single Entry" />
        <ModeBtn mode={mode} setMode={setMode} isMobile={isMobile} id="multi"     icon="📋" label="Multi-Subject" />
        <ModeBtn mode={mode} setMode={setMode} isMobile={isMobile} id="bulk"      icon="🔀" label="One Subject → Many Courses" />
        <ModeBtn mode={mode} setMode={setMode} isMobile={isMobile} id="generate"  icon="⚡" label="Auto-Generate Timetable" />
        <ModeBtn mode={mode} setMode={setMode} isMobile={isMobile} id="autoconfig" icon="🎯" label="From Active Config (All Batches)" />
        <ModeBtn mode={mode} setMode={setMode} isMobile={isMobile} id="duplicate" icon="📄" label="Duplicate Entries" />
        <ModeBtn mode={mode} setMode={setMode} isMobile={isMobile} id="import"    icon="📂" label="Import CSV/Excel" />
      </div>

      {/* SINGLE ENTRY */}
      {mode === "single" && (
        <div style={twoCols}>
          <div style={css.card}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#14213d", marginBottom: 14 }}>➕ Add Single Entry</div>
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
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#14213d", marginBottom: 4 }}>📋 Multi-Subject Entry</div>
            <div style={{ fontSize: 12, color: "#8a93a6", marginBottom: 14 }}>Add all subjects for a course at once.</div>
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
                  {courses.map(c => <button key={c} onClick={() => setMsCourse(c)} style={{ ...css.btn, padding: "5px 12px", fontSize: 11, background: msCourse === c ? "#132a4f" : "#f3f0e8", color: msCourse === c ? "white" : "#2e3b52", border: msCourse === c ? "none" : "1px solid #E5E7EB" }}>{c}</button>)}
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
              style={{ ...css.btn, background: msSaved ? "#16A34A" : msSaving ? "#b7c6e0" : "#132a4f", color: "white", width: "100%", fontSize: 13 }}>
              {msSaved ? `✓ Saved!` : msSaving ? "Saving…" : `💾 Save ${msRows.filter(r=>r.date).length} Entries`}
            </button>
          </div>
          <div style={css.card}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, marginBottom: 14 }}>Subjects for <span style={{ color: "#132a4f" }}>{msCourse}</span></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 480, overflowY: "auto" }}>
              {msRows.map((r, i) => (
                <div key={r.subject} style={{ display: "grid", gridTemplateColumns: "1fr 130px 70px", gap: 8, alignItems: "center", padding: "8px 10px", background: i % 2 ? "#faf8f3" : "white", borderRadius: 8, border: "1px solid #F1F5F9" }}>
                  <div style={{ fontWeight: 600, fontSize: 12 }}><span style={{ fontSize: 10, color: "#8a93a6", marginRight: 4 }}>{i+1}.</span>{r.subject}</div>
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
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#14213d", marginBottom: 4 }}>🔀 One Subject → Many Courses</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><FieldLabel>Exam Type</FieldLabel><select value={bkExamType} onChange={e => setBkExamType(e.target.value)} style={css.input}>{examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
              <div><FieldLabel>Subject Name</FieldLabel><input value={bkSubject} onChange={e => setBkSubject(e.target.value)} placeholder="e.g. Mathematics" style={css.input} /></div>
              <div><FieldLabel>Date</FieldLabel><input type="date" value={bkDate} onChange={e => setBkDate(e.target.value)} style={css.input} /></div>
              <div><FieldLabel>Total Marks <span style={{ fontWeight:400, color:"#8a93a6", textTransform:"none" }}>(applied to all selected courses)</span></FieldLabel>
                <input type="number" value={bkMarks} onChange={e => setBkMarks(e.target.value)} style={css.input} />
                {bkSubject && bkCourses.size > 0 && (
                  <div style={{ fontSize:11, color:"#8a93a6", marginTop:4 }}>
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
                  <button onClick={() => setBkCourses(new Set(courses))} style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: "#eef2f9", color: "#1e3a6e" }}>All</button>
                  <button onClick={() => setBkCourses(new Set())} style={{ ...css.btn, padding: "4px 10px", fontSize: 11, background: "#FEF2F2", color: "#DC2626" }}>None</button>
                  {courses.map(c => { const sel = bkCourses.has(c); return <button key={c} onClick={() => setBkCourses(p => { const n = new Set(p); sel ? n.delete(c) : n.add(c); return n; })} style={{ ...css.btn, padding: "5px 12px", fontSize: 11, background: sel ? "#132a4f" : "#f3f0e8", color: sel ? "white" : "#2e3b52", border: sel ? "none" : "1px solid #E5E7EB" }}>{sel ? "✓ " : ""}{c}</button>; })}
                </div>
              </div>
              <button onClick={handleSaveBulk} disabled={bkSaving || !bkCourses.size || !bkDate || !bkSubject}
                style={{ ...css.btn, background: bkSaved ? "#16A34A" : bkSaving ? "#b7c6e0" : "#132a4f", color: "white", fontSize: 13 }}>
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
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#14213d", marginBottom: 4 }}>⚡ Auto-Generate Timetable</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div><FieldLabel>Exam Type</FieldLabel><select value={genExamType} onChange={e => setGenExamType(e.target.value)} style={css.input}>{examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
              <div><FieldLabel>Course</FieldLabel>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {courses.map(c => <button key={c} onClick={() => setGenCourse(c)} style={{ ...css.btn, padding: "5px 12px", fontSize: 11, background: genCourse === c ? "#132a4f" : "#f3f0e8", color: genCourse === c ? "white" : "#2e3b52", border: genCourse === c ? "none" : "1px solid #E5E7EB" }}>{c}</button>)}
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
                    <div key={s.subject} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", background: "#faf8f3", borderRadius: 8, border: "1px solid #E5E7EB" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <button onClick={() => { if (i === 0) return; const n = [...genSubjectOrder]; [n[i-1], n[i]] = [n[i], n[i-1]]; setGenSubjectOrder(n); }} style={{ ...css.btn, padding: "1px 5px", fontSize: 10, background: "#e8e3d8", color: "#2e3b52" }}>▲</button>
                        <button onClick={() => { if (i === genSubjectOrder.length - 1) return; const n = [...genSubjectOrder]; [n[i], n[i+1]] = [n[i+1], n[i]]; setGenSubjectOrder(n); }} style={{ ...css.btn, padding: "1px 5px", fontSize: 10, background: "#e8e3d8", color: "#2e3b52" }}>▼</button>
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
                <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 600, color: "#14213d" }}>{genPreview.length} exam days generated</div>
                <div style={{ fontSize: 12, color: "#8a93a6", marginTop: 2 }}>{genCourse} · starts {genStartDate || "—"}</div>
              </div>
              <button onClick={handleSaveGenerate} disabled={!genPreview.length || genSaving}
                style={{ ...css.btn, background: genSaved ? "#16A34A" : genSaving ? "#b7c6e0" : "#132a4f", color: "white", padding: "10px 22px", fontSize: 13 }}>
                {genSaved ? `✓ Saved!` : genSaving ? "Saving…" : `💾 Save ${genPreview.length} Entries`}
              </button>
            </div>
            <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
              <div style={{ padding: "11px 18px", background: "#132a4f", color: "white", fontWeight: 700, fontSize: 13 }}>📅 Preview</div>
              <div style={{ overflowX: "auto" }}>
                <table className="gx-rt" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 340 }}>
                  <thead><tr style={{ background: "#faf8f3", borderBottom: "2px solid #E5E7EB" }}>
                    {["#","Date","Day","Subject","Marks"].map(h => <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontWeight: 700, color: "#2e3b52", fontSize: 11 }}>{h}</th>)}
                  </tr></thead>
                  <tbody>
                    {genPreview.map((r, i) => {
                      const day = new Date(r.exam_date).toLocaleDateString("en-IN", { weekday: "short" });
                      return <tr key={i} style={{ background: i % 2 ? "#faf8f3" : "white", borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "8px 14px", color: "#8a93a6", fontSize: 12 }}>{i+1}</td>
                        <td style={{ padding: "8px 14px", fontWeight: 600 }}>{r.exam_date}</td>
                        <td style={{ padding: "8px 14px", color: "#5d6b82" }}>{day}</td>
                        <td style={{ padding: "8px 14px", fontWeight: 600, color: "#132a4f" }}>{r.subject}</td>
                        <td style={{ padding: "8px 14px", color: "#5d6b82" }}>{r.total_marks}</td>
                      </tr>;
                    })}
                    {!genPreview.length && <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#8a93a6" }}>Set a start date to preview.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AUTO-GENERATE FROM ACTIVE CONFIG (all batches at once) */}
      {mode === "autoconfig" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {!activeExamConfig && (
            <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E", padding: "12px 16px", borderRadius: 8, fontSize: 13 }}>
              ⚠️ No active exam config found. Go to <b>Exam Config</b> and set one as active first — this tool generates a schedule for every batch defined in whichever config is currently active there.
            </div>
          )}
          {activeExamConfig && (
            <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "10px 16px", borderRadius: 8, fontSize: 13 }}>
              🎯 Active config: <b>{activeExamConfig.name}</b> — {acConfigBatches.length} batch(es), {acConfigBatches.reduce((n, c) => n + (activeExamConfig.courseSubjects[c]?.length || 0), 0)} subject-slots total.
            </div>
          )}
          <div style={{ display: isMobile ? "flex" : "grid", flexDirection: "column", gridTemplateColumns: "320px 1fr", gap: isMobile ? 14 : 20 }}>
            <div style={css.card}>
              <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#14213d", marginBottom: 4 }}>🎯 From Active Config</div>
              <div style={{ fontSize: 12, color: "#8a93a6", marginBottom: 14 }}>
                Generates one schedule entry per subject, for every batch the active config defines — subjects and max marks come straight from the config, so there's nothing to re-enter here.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div><FieldLabel>Exam Type</FieldLabel><select value={acExamType} onChange={e => setAcExamType(e.target.value)} style={css.input}>{examTypes.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
                <div><FieldLabel>Start Date</FieldLabel><input type="date" value={acStartDate} onChange={e => setAcStartDate(e.target.value)} style={css.input} /></div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div><FieldLabel>Shift</FieldLabel><select value={acShift} onChange={e => setAcShift(e.target.value)} style={css.input}><option>Morning</option><option>Afternoon</option><option>Evening</option></select></div>
                  <div><FieldLabel>Time</FieldLabel><input type="time" value={acTime} onChange={e => setAcTime(e.target.value)} style={css.input} /></div>
                </div>
                <div><FieldLabel>Room</FieldLabel><input value={acRoom} onChange={e => setAcRoom(e.target.value)} style={css.input} placeholder="Optional" /></div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={acSkipWeekends} onChange={e => setAcSkipWeekends(e.target.checked)} />Skip weekends
                </label>
                <label style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input type="checkbox" checked={acSameDateAllBatches} onChange={e => setAcSameDateAllBatches(e.target.checked)} style={{ marginTop: 2 }} />
                  <span>All batches start on the same date<div style={{ fontSize: 11, color: "#8a93a6" }}>Uncheck to run one batch's subjects, then continue straight into the next batch's subjects on the following day.</div></span>
                </label>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ ...css.card, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div>
                  <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 16, fontWeight: 600, color: "#14213d" }}>{acNewRows.length} entries will be created</div>
                  <div style={{ fontSize: 12, color: "#8a93a6", marginTop: 2 }}>
                    {acConfigBatches.length} batches · starts {acStartDate || "—"}
                    {acSkippedCount > 0 && ` · ${acSkippedCount} already scheduled, skipped`}
                  </div>
                </div>
                <button onClick={handleSaveAutoGenerate} disabled={!acNewRows.length || acSaving}
                  style={{ ...css.btn, background: acSaved ? "#16A34A" : acSaving ? "#b7c6e0" : "#132a4f", color: "white", padding: "10px 22px", fontSize: 13 }}>
                  {acSaved ? `✓ Saved!` : acSaving ? "Saving…" : `💾 Save ${acNewRows.length} Entries`}
                </button>
              </div>
              {acError && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#DC2626", padding: "10px 14px", borderRadius: 8, fontSize: 13 }}>⚠️ {acError}</div>}
              <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
                <div style={{ padding: "11px 18px", background: "#132a4f", color: "white", fontWeight: 700, fontSize: 13 }}>📅 Preview</div>
                <div style={{ overflowX: "auto", maxHeight: 480, overflowY: "auto" }}>
                  <table className="gx-rt" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 420 }}>
                    <thead style={{ position: "sticky", top: 0 }}><tr style={{ background: "#faf8f3", borderBottom: "2px solid #E5E7EB" }}>
                      {["Batch","Date","Day","Subject","Marks","Status"].map(h => <th key={h} style={{ padding: "9px 14px", textAlign: "left", fontWeight: 700, color: "#2e3b52", fontSize: 11 }}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {acPreview.map((r, i) => {
                        const day = new Date(r.exam_date).toLocaleDateString("en-IN", { weekday: "short" });
                        const alreadyExists = acExistingKeys.has(`${r.course}|${r.subject}`);
                        return <tr key={i} style={{ background: alreadyExists ? "#FFFBEB" : (i % 2 ? "#faf8f3" : "white"), borderBottom: "1px solid #F1F5F9" }}>
                          <td style={{ padding: "8px 14px" }}><span style={{ background: "#eef2f9", color: "#1e3a6e", padding: "2px 8px", borderRadius: 999, fontSize: 10.5, fontWeight: 700 }}>{r.course}</span></td>
                          <td style={{ padding: "8px 14px", fontWeight: 600 }}>{r.exam_date}</td>
                          <td style={{ padding: "8px 14px", color: "#5d6b82" }}>{day}</td>
                          <td style={{ padding: "8px 14px", fontWeight: 600, color: "#132a4f" }}>{r.subject}</td>
                          <td style={{ padding: "8px 14px", color: "#5d6b82" }}>{r.total_marks}</td>
                          <td style={{ padding: "8px 14px" }}>{alreadyExists
                            ? <span style={{ fontSize: 10.5, color: "#92400E", fontWeight: 700 }}>Already scheduled</span>
                            : <span style={{ fontSize: 10.5, color: "#166534", fontWeight: 700 }}>New</span>}</td>
                        </tr>;
                      })}
                      {!acPreview.length && <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#8a93a6" }}>{activeExamConfig ? "Set a start date to preview." : "Set an active exam config first."}</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DUPLICATE */}
      {mode === "duplicate" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ ...css.card, display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 15, fontWeight: 600, color: "#14213d", flex: "0 0 100%", marginBottom: 4 }}>📄 Duplicate Schedule Entries to a New Date</div>
            <div><FieldLabel>Copy to Date</FieldLabel><input type="date" value={dupDate} onChange={e => setDupDate(e.target.value)} style={{ ...css.input, width: 180 }} /></div>
            <div style={{ fontSize: 12, color: "#8a93a6", alignSelf: "center" }}>{dupIds.size} entries selected</div>
            <button onClick={handleDuplicate} disabled={!dupIds.size || !dupDate || dupSaving}
              style={{ ...css.btn, background: dupSaved ? "#16A34A" : dupSaving ? "#b7c6e0" : "#a7771f", color: "white", fontSize: 13 }}>
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
            <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, fontSize: 16, color: "#14213d", marginBottom: 4 }}>📂 Import from CSV / Excel</div>
            <div style={{ fontSize: 12, color: "#8a93a6", marginBottom: 16 }}>Columns: <b>course, subject, date, type, time, shift, room, marks</b></div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <button onClick={downloadImportTemplate} style={{ ...css.btn, background: "#eef2f9", color: "#1e3a6e", border: "1px solid #c9d5ea", fontSize: 12 }}>📋 Download Template</button>
              <input ref={fileInputRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }} onChange={handleFileUpload} />
              <button onClick={() => fileInputRef.current?.click()} style={{ ...css.btn, background: "#a7771f", color: "white", fontSize: 13 }}>📂 Upload File</button>
              {importRows.length > 0 && <div style={{ background: "#E1F5EE", border: "1px solid #BBF7D0", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#0F6E56" }}>✅ {importRows.length} rows ready</div>}
              {importErrors.length > 0 && <div style={{ background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#92400E" }}>⚠️ {importErrors.length} rows skipped</div>}
              {importRows.length > 0 && !importDone && (
                <button onClick={handleImportSave} disabled={importSaving} style={{ ...css.btn, background: importSaving ? "#b7c6e0" : "#132a4f", color: "white", fontSize: 13 }}>
                  {importSaving ? "Saving…" : `💾 Confirm Import (${importRows.length})`}
                </button>
              )}
              {importDone && <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", color: "#166534", padding: "10px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600 }}>✅ Import complete!</div>}
            </div>
          </div>
          <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <div style={{ padding: "11px 18px", background: "#132a4f", color: "white", fontWeight: 700, fontSize: 13 }}>{importRows.length ? `📋 Preview (${importRows.length})` : "📋 Awaiting upload…"}</div>
            {importRows.length > 0 ? (
              <div style={{ overflowX: "auto", maxHeight: 400, overflowY: "auto" }}>
                <table className="gx-rt" style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 480 }}>
                  <thead style={{ position: "sticky", top: 0 }}>
                    <tr style={{ background: "#faf8f3", borderBottom: "2px solid #E5E7EB" }}>
                      {["Course","Subject","Date","Exam Type","Shift","Time","Room","Marks"].map(h => <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 700, color: "#2e3b52", fontSize: 11 }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {importRows.map((r, i) => (
                      <tr key={i} style={{ background: i % 2 ? "#faf8f3" : "white", borderBottom: "1px solid #F1F5F9" }}>
                        <td style={{ padding: "8px 12px" }}><span style={{ background: "#E1F5EE", color: "#0F6E56", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{r.course}</span></td>
                        <td style={{ padding: "8px 12px", fontWeight: 600 }}>{r.subject}</td>
                        <td style={{ padding: "8px 12px" }}>{r.exam_date}</td>
                        <td style={{ padding: "8px 12px", color: "#5d6b82" }}>{examTypes.find(e => e.id === r.exam_type_id)?.name || r.exam_type_id}</td>
                        <td style={{ padding: "8px 12px", color: "#5d6b82" }}>{r.shift}</td>
                        <td style={{ padding: "8px 12px", color: "#5d6b82" }}>{r.time}</td>
                        <td style={{ padding: "8px 12px", color: "#5d6b82" }}>{r.room || "—"}</td>
                        <td style={{ padding: "8px 12px", color: "#5d6b82" }}>{r.total_marks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <div style={{ padding: 60, textAlign: "center", color: "#8a93a6" }}><div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>Upload a file to preview.</div>}
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
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Filter Course</label>
          <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
            {["ALL", ...courses].map(c => (
              <button key={c} onClick={() => setFilterCourse(c)}
                style={{ ...css.btn, padding: "5px 10px", fontSize: 11, background: filterCourse === c ? "#132a4f" : "#f3f0e8", color: filterCourse === c ? "white" : "#2e3b52", border: filterCourse === c ? "none" : "1px solid #E5E7EB" }}>{c}</button>
            ))}
          </div>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Filter Type</label>
          <select value={filterExamType} onChange={e => setFilterExamType(e.target.value)} style={{ ...css.input, width: 180 }}>
            <option value="ALL">All Types</option>
            {examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
          </select>
        </div>
        {selectable && (
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={onSelectAll} style={{ ...css.btn, padding: "5px 10px", fontSize: 11, background: "#eef2f9", color: "#1e3a6e" }}>Select All</button>
            <button onClick={onDeselectAll} style={{ ...css.btn, padding: "5px 10px", fontSize: 11, background: "#FEF2F2", color: "#DC2626" }}>Deselect All</button>
          </div>
        )}
        <div style={{ fontSize: 12, color: "#8a93a6", alignSelf: "center" }}>{schedule.length} entries</div>
      </div>
      <div style={{ background: "white", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", background: "#132a4f", color: "white", fontWeight: 700, fontSize: 13 }}>📅 Exam Schedule</div>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table className="gx-rt" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 600 }}>
            <thead><tr style={{ background: "#faf8f3", borderBottom: "2px solid #E5E7EB" }}>
              {selectable && <th style={{ padding: "10px 12px", width: 36 }}></th>}
              {["Date","Course","Exam Type","Subject","Shift","Time","Marks","Room",""].map(h => (
                <th key={h} style={{ padding: "10px 10px", textAlign: "left", fontWeight: 700, color: "#2e3b52", fontSize: 11 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {schedule.map((s, i) => {
                const missingForAdmitCard = !s.time || !s.room;
                return (
                <tr key={s.id} style={{ background: selectable && selected && selected.has(s.id) ? "#eef2f9" : i % 2 ? "#faf8f3" : "white", borderBottom: "1px solid #F1F5F9" }}>
                  {selectable && <td style={{ padding: "9px 12px", textAlign: "center" }}><input type="checkbox" checked={selected && selected.has(s.id) || false} onChange={() => onToggle(s.id)} /></td>}
                  <td style={{ padding: "9px 10px", fontWeight: 600 }}>{s.exam_date}</td>
                  <td style={{ padding: "9px 10px" }}><span style={{ background: "#E1F5EE", color: "#0F6E56", padding: "2px 7px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{s.course || "—"}</span></td>
                  <td style={{ padding: "9px 10px" }}>{examTypes.find(e => e.id === s.exam_type_id)?.name || s.exam_type_id}</td>
                  <td style={{ padding: "9px 10px" }}>{s.subject}</td>
                  {editingId === s.id ? (
                    <>
                      <td style={{ padding: "6px 8px" }}><input value={editForm.shift} onChange={e => setEditForm(p => ({ ...p, shift: e.target.value }))} placeholder="Morning" style={{ ...css.input, width: 90, fontSize: 12 }} /></td>
                      <td style={{ padding: "6px 8px" }}><input value={editForm.time} onChange={e => setEditForm(p => ({ ...p, time: e.target.value }))} placeholder="09:00 AM" style={{ ...css.input, width: 90, fontSize: 12 }} /></td>
                      <td style={{ padding: "9px 10px", color: "#5d6b82" }}>{s.total_marks}</td>
                      <td style={{ padding: "6px 8px" }}><input value={editForm.room} onChange={e => setEditForm(p => ({ ...p, room: e.target.value }))} placeholder="Hall 2" style={{ ...css.input, width: 90, fontSize: 12 }} /></td>
                      <td style={{ padding: "9px 10px" }}>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button onClick={() => saveEdit(s.id)} disabled={savingEdit} style={{ ...css.btn, padding: "4px 10px", background: "#132a4f", color: "white", fontSize: 11 }}>{savingEdit ? "…" : "✓"}</button>
                          <button onClick={cancelEdit} style={{ ...css.btn, padding: "4px 8px", background: "#f3f0e8", color: "#2e3b52", fontSize: 11 }}>✕</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={{ padding: "9px 10px", color: "#5d6b82" }}>{s.shift || "Morning"}</td>
                      <td style={{ padding: "9px 10px", color: missingForAdmitCard ? "#DC2626" : "#5d6b82", fontWeight: missingForAdmitCard ? 700 : 400 }}>{s.time || "-- (not set)"}</td>
                      <td style={{ padding: "9px 10px", color: "#5d6b82" }}>{s.total_marks}</td>
                      <td style={{ padding: "9px 10px", color: missingForAdmitCard ? "#DC2626" : "#5d6b82", fontWeight: missingForAdmitCard ? 700 : 400 }}>{s.room || "-- (not set)"}</td>
                      <td style={{ padding: "9px 10px" }}>
                        <div style={{ display: "flex", gap: 5 }}>
                          <button onClick={() => startEdit(s)} title={missingForAdmitCard ? "Add time/room for Admit Cards" : "Edit time/shift/room"}
                            style={{ ...css.btn, padding: "4px 8px", background: missingForAdmitCard ? "#FFFBEB" : "#eef2f9", color: missingForAdmitCard ? "#92400E" : "#1e3a6e", border: `1px solid ${missingForAdmitCard ? "#FDE68A" : "#c9d5ea"}`, fontSize: 11 }}>✏️</button>
                          <button onClick={() => onDelete(s.id)} style={{ ...css.btn, padding: "4px 8px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", fontSize: 11 }}>✕</button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
                );
              })}
              {!schedule.length && <tr><td colSpan={selectable ? 10 : 9} style={{ padding: 32, textAlign: "center", color: "#8a93a6" }}>No schedule entries yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── SEAT ARRANGEMENT (mobile: stacked layout) ───────────────────────────────
function SeatArrangement({ courseSubjects, examTypes, students, schedule }) {
  const isMobile = useMobile();
  const courses = Object.keys(courseSubjects);

  const [examType, setExamType]     = useState(examTypes[0]?.id || "");
  const [examDate, setExamDate]     = useState("");
  const [dates, setDates]           = useState([]);
  const [room, setRoom]             = useState("");
  const [seats, setSeats]           = useState({});
  const [, setSavedSeats]       = useState({});
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
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

    const occupiedCount = Object.values(seats).filter(Boolean).length;
  const rows = Math.ceil(capacity / cols);

  return (
    <div>
      <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:14, alignItems:"flex-end" }}>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5d6b82", marginBottom:5, textTransform:"uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e=>setExamType(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 200 }}>
            {examTypes.map(et=><option key={et.id} value={et.id}>{et.name}</option>)}
          </select>
        </div>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5d6b82", marginBottom:5, textTransform:"uppercase" }}>Date</label>
          <select value={examDate} onChange={e=>setExamDate(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 160 }}>
            <option value="">— Pick —</option>
            {dates.map(d=><option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5d6b82", marginBottom:5, textTransform:"uppercase" }}>Cap.</label>
          <input type="number" value={capacity} onChange={e=>setCapacity(Math.max(1,Number(e.target.value)))} style={{ ...css.input, width:70 }} />
        </div>
        <div>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5d6b82", marginBottom:5, textTransform:"uppercase" }}>Cols</label>
          <input type="number" value={cols} onChange={e=>setCols(Math.max(1,Math.min(10,Number(e.target.value))))} style={{ ...css.input, width:60 }} />
        </div>
      </div>

      <div style={{ background:"#eef2f9", border:"1px solid #BFDBFE", borderRadius:8, padding:"10px 16px", marginBottom:14, fontSize:12, color:"#1e3a6e" }}>
        ℹ️ First time? Run the SQL in the SeatArrangement component comments in Supabase.
      </div>

      {/* Layout: stacked on mobile, side-by-side on desktop */}
      <div style={{ display: isMobile ? "flex" : "grid", flexDirection: "column", gridTemplateColumns: "220px 1fr", gap: isMobile ? 14 : 20 }}>

        {/* Left: Rooms + Student list */}
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", overflow:"hidden" }}>
            <div style={{ padding:"11px 16px", background:"#132a4f", color:"white", fontWeight:700, fontSize:13 }}>🏫 Rooms</div>
            <div style={{ padding:12, display:"flex", flexDirection:"column", gap:6 }}>
              {isMobile ? (
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {allRooms.map(r => (
                    <button key={r} onClick={()=>setRoom(r)} style={{ ...css.btn, padding:"6px 12px", background:room===r?"#132a4f":"#f3f0e8", color:room===r?"white":"#2e3b52", border:room===r?"none":"1px solid #E5E7EB", fontSize:12 }}>🏫 {r}</button>
                  ))}
                </div>
              ) : allRooms.map(r => (
                <button key={r} onClick={()=>setRoom(r)} style={{ ...css.btn, padding:"8px 14px", textAlign:"left", background:room===r?"#132a4f":"#f3f0e8", color:room===r?"white":"#2e3b52", border:room===r?"none":"1px solid #E5E7EB", fontSize:12 }}>🏫 {r}</button>
              ))}
              {!allRooms.length && <div style={{ fontSize:12, color:"#8a93a6" }}>No rooms yet.</div>}
              <div style={{ display:"flex", gap:6, marginTop:4 }}>
                <input value={newRoom} onChange={e=>setNewRoom(e.target.value)} placeholder="New room…" style={css.input} onKeyDown={e=>{ if(e.key==="Enter") addRoom(); }} />
                <button onClick={addRoom} style={{ ...css.btn, padding:"6px 10px", background:"#eef2f9", color:"#1e3a6e", fontSize:12, whiteSpace:"nowrap" }}>+ Add</button>
              </div>
            </div>
          </div>

          <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", overflow:"hidden" }}>
            <div style={{ padding:"11px 16px", background:"#132a4f", color:"white", fontWeight:700, fontSize:13 }}>👤 Students</div>
            <div style={{ padding:10 }}>
              <input placeholder="🔍 Search…" value={search} onChange={e=>setSearch(e.target.value)} style={{ ...css.input, marginBottom:8, fontSize:12 }} />
              <div style={{ display:"flex", flexWrap:"wrap", gap:4, marginBottom:8 }}>
                {["ALL",...courses].map(c=>(
                  <button key={c} onClick={()=>setFilterCourse(c)} style={{ ...css.btn, padding:"3px 8px", fontSize:10, background:filterCourse===c?"#132a4f":"#f3f0e8", color:filterCourse===c?"white":"#2e3b52", border:filterCourse===c?"none":"1px solid #E5E7EB" }}>{c}</button>
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
                    <div style={{ fontWeight:600, fontSize:12, color:inRoom?"#0F6E56":inOther?"#92400E":"#14213d" }}>{st.name}</div>
                    <div style={{ fontSize:10, color:"#8a93a6" }}>GCC {st.gcc_no} · {st.class_name||st.course}{inRoom?" · ✓":inOther?" · ⚠️ Other room":""}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right: Actions + Seat grid */}
        <div>
          <div style={{ display:"flex", gap:8, marginBottom:12, alignItems:"center", flexWrap:"wrap" }}>
            <div style={{ background:"white", borderRadius:10, padding:"10px 14px", boxShadow:"0 1px 4px rgba(0,0,0,0.06)", fontSize:13, fontWeight:600, color:"#132a4f" }}>
              🏫 <b>{room||"No room"}</b>
              <span style={{ fontWeight:400, color:"#8a93a6", marginLeft:8 }}>{occupiedCount}/{capacity}</span>
            </div>
            <button onClick={autoAssign} style={{ ...css.btn, background:"#a7771f", color:"white", fontSize:12 }}>⚡ Auto</button>
            <button onClick={clearRoom} style={{ ...css.btn, background:"#FEF2F2", color:"#DC2626", border:"1px solid #FECACA", fontSize:12 }}>🗑️ Clear</button>
            <button onClick={handleSave} disabled={saving||!room} style={{ ...css.btn, background:saved?"#16A34A":saving?"#b7c6e0":"#1e3a6e", color:"white", fontSize:12 }}>
              {saved?"✓ Saved!":saving?"Saving…":"💾 Save"}
            </button>
          </div>

          <div style={{ background:"white", borderRadius:8, padding:"8px 14px", marginBottom:12, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#5d6b82", marginBottom:5 }}>
              <span>Capacity</span><span style={{ fontWeight:700, color:"#132a4f" }}>{occupiedCount} / {capacity}</span>
            </div>
            <div style={{ height:6, background:"#f3f0e8", borderRadius:999, overflow:"hidden" }}>
              <div style={{ height:"100%", width:`${(occupiedCount/capacity)*100}%`, background:"#132a4f", borderRadius:999, transition:"width .3s" }} />
            </div>
          </div>

          {loading ? <Spinner /> : !room ? (
            <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", padding:40, textAlign:"center", color:"#8a93a6" }}>
              <div style={{ fontSize:40, marginBottom:12 }}>🏫</div>
              <div style={{ fontSize:14, fontWeight:600 }}>Select or add a room to begin</div>
            </div>
          ) : (
            <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", padding:16, overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
              <div style={{ display:"inline-flex", flexDirection:"column", gap:8, minWidth:"100%" }}>
                <div style={{ display:"flex", gap:8 }}>
                  {Array.from({length:cols},(_,c)=>(
                    <div key={c} style={{ width:100, textAlign:"center", fontSize:10, fontWeight:700, color:"#8a93a6", textTransform:"uppercase" }}>Col {c+1}</div>
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
                          style={{ width:100, minHeight:66, borderRadius:8, border:st?"1.5px solid #86EFAC":"1.5px dashed #D1D5DB", background:st?"#F0FDF4":"#faf8f3", padding:"5px 7px", cursor:st?"pointer":"default", position:"relative", transition:"all .15s" }}>
                          <div style={{ position:"absolute", top:4, right:6, fontSize:9, fontWeight:800, color:st?"#0F6E56":"#d9d2c2" }}>{seatNum}</div>
                          {st ? (
                            <>
                              <div style={{ fontSize:10, fontWeight:700, color:"#14213d", lineHeight:1.3, paddingRight:14, marginTop:2 }}>{st.name}</div>
                              <div style={{ fontSize:9, color:"#5d6b82", marginTop:2 }}>GCC {st.gcc_no}</div>
                              <div style={{ fontSize:8.5, color:"#8a93a6" }}>{st.class_name||st.course}</div>
                              <div title="Click to remove" style={{ position:"absolute", top:3, left:5, fontSize:9, color:"#FCA5A5", cursor:"pointer" }}>✕</div>
                            </>
                          ) : (
                            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", height:"100%", color:"#e8e3d8", fontSize:10, paddingTop:8 }}>Drop here</div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display:"flex", gap:14, marginTop:10, fontSize:12, color:"#5d6b82" }}>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:12, height:12, borderRadius:3, background:"#F0FDF4", border:"1.5px solid #86EFAC" }} /> Assigned</div>
            <div style={{ display:"flex", alignItems:"center", gap:5 }}><div style={{ width:12, height:12, borderRadius:3, background:"#faf8f3", border:"1.5px dashed #D1D5DB" }} /> Vacant</div>
            {!isMobile && <span style={{ color:"#8a93a6" }}>Drag students · Click to remove</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Report card print — same A4 design as the fee receipt (premiumReceipt.js) ─
// Letterhead · REPORT CARD band · boxed candidate grid · subject table ·
// totals block · result stamp · remarks · signatures.
const REPORT_CARD_CSS = `
  .rc-score{display:grid;grid-template-columns:repeat(5,1fr);margin-top:10px;border:1px solid #0B1E3D;background:#0B1E3D;border-radius:6px;overflow:hidden}
  .rc-score div{text-align:center;padding:9px 6px;border-right:1px solid rgba(255,255,255,.18)}
  .rc-score div:last-child{border-right:none}
  .rc-score .l{color:#CBD5E1}
  .rc-score .n{font-size:19px;font-weight:800;color:#fff;margin-top:3px;font-family:'JetBrains Mono',monospace}
  .rc-score .n small{font-size:10px;opacity:.6;font-weight:600}
  .rc-score .n.gold{color:#E2C57E}
  .rc-score .s{font-size:9px;color:#CBD5E1;margin-top:1px}
  .rc-bar{display:flex;align-items:center;gap:6px}
  .rc-bar i{flex:1;height:6px;background:#E2E8F0;border-radius:3px;overflow:hidden;display:block}
  .rc-bar b{display:block;height:100%;border-radius:3px}
  .rc-bar span{font-size:10px;font-weight:700;min-width:34px;text-align:right}
  .rc-g{display:inline-block;padding:1px 8px;border-radius:3px;font-size:11px;font-weight:800;border:1px solid}
  .rc-remark{margin-top:10px;border:1px solid #E6DCC3;background:#FFFCF4;border-radius:8px;padding:8px 12px;border-left:4px solid #C9A24B}
  .rc-remark p{font-size:12px;font-style:italic;color:#334155;line-height:1.55;margin-top:3px}
  .rc-sec{font-size:9.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#334155;margin:12px 0 5px}
`;

// ─── buildReportCardHTML ──────────────────────────────────────────────────────
function buildReportCardHTML(st, subjects, subjectMaxMap, courseMax, marksMap, course, allStudents, examName, examDate, institute, remarkText) {
  const getTotal = sid => subjects.reduce((s,sub)=>s+(Number(marksMap[`${sid}-${sub}`])||0),0);
  const total = getTotal(st.id);
  const pct = courseMax ? (total / courseMax) * 100 : 0;
  const grade = getGrade(pct);
  const passed = pct >= 40;
  const PASS = "#047857", FAIL = "#B42318";
  const resColor = passed ? PASS : FAIL;

  const sortedStudents = [...allStudents].map(s=>({...s,total:getTotal(s.id)})).sort((a,b)=>b.total-a.total);
  let rank=1,prev=null;
  for(let i=0;i<sortedStudents.length;i++){
    if(i===0){rank=1;prev=sortedStudents[i].total;}else if(sortedStudents[i].total!==prev){rank++;prev=sortedStudents[i].total;}
    if(sortedStudents[i].id===st.id)break;
  }
  const rankSuffix=rank===1?"st":rank===2?"nd":rank===3?"rd":"th";
  const year = institute.academicYear||"2025-2026";
  const exam = rcEsc(examName);

  const subjectRows = subjects.map((s,idx)=>{
    const m=Number(marksMap[`${st.id}-${s}`])||0;
    const subMax=(subjectMaxMap && subjectMaxMap[s]) || 100;
    const subPct=Math.round((m/subMax)*100);
    const subPassed=subPct>=40;
    const barColor=subPct>=80?"#1F4E8C":subPct>=60?"#0EA5A4":subPct>=40?"#BA7517":FAIL;
    const gradeLbl=subPct>=90?"A+":subPct>=80?"A":subPct>=70?"B+":subPct>=60?"B":subPct>=50?"C":subPct>=40?"D":"F";
    return `<tr>
      <td>${idx+1}</td>
      <td style="font-weight:700">${rcEsc(s)}</td>
      <td class="r mono">${subMax}</td>
      <td class="r mono" style="font-weight:700">${m}</td>
      <td><div class="rc-bar"><i><b style="width:${Math.min(subPct,100)}%;background:${barColor}"></b></i><span style="color:${barColor}">${subPct}%</span></div></td>
      <td style="text-align:center"><span class="rc-g" style="color:${barColor};border-color:${barColor}">${gradeLbl}</span></td>
      <td style="text-align:center;font-size:10px;font-weight:800;color:${subPassed?PASS:FAIL}">${subPassed?"PASS":"FAIL"}</td>
    </tr>`;
  }).join("");

  const remarkBlock = remarkText
    ? `<div class="rc-remark"><div class="l">Teacher's remarks</div><p>“${rcEsc(remarkText)}”</p></div>`
    : "";
  const cell = (l,v,extra='') => `<td class="c"${extra}><div class="l">${l}</div><div class="v">${v}</div></td>`;

  const body = `
    <div class="wrap">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:12px">
        <div><div class="l">Examination</div><div style="font-size:16px;font-weight:700;color:#0B1E3D;margin-top:2px">${exam}</div></div>
        <div style="text-align:center"><div class="l">Academic year</div><div style="font-size:13px;font-weight:700;margin-top:2px">${rcEsc(year)}</div></div>
        <div style="text-align:right"><div class="l">Exam date</div><div style="font-size:13px;font-weight:700;margin-top:2px">${rcEsc(examDate||"—")}</div></div>
      </div>
      <table class="info"><tbody>
        <tr>${cell('Student Name', rcEsc(st.name), ' colspan="2"')}${cell('GCC / Roll No.', `<span class="mono">GCC-${rcEsc(String(st.gcc_no||"").padStart(6,"0"))}</span>`)}${cell('Admission No.', rcEsc(st.admission_no && st.admission_no !== '--' ? st.admission_no : '—'))}</tr>
        <tr>${cell('Course', rcEsc(st.course||course||'—'), ' colspan="2"')}${cell('Class / Batch', rcEsc(st.class_name||'—'))}${cell('Class Rank', `${rank}${rankSuffix} of ${allStudents.length}`)}</tr>
      </tbody></table>
      <div class="rc-score">
        <div><div class="l">Marks Obtained</div><div class="n">${total}<small> / ${courseMax}</small></div></div>
        <div><div class="l">Percentage</div><div class="n gold">${pct.toFixed(1)}%</div></div>
        <div><div class="l">Grade</div><div class="n">${rcEsc(grade.label)}</div><div class="s">${grade.gpa.toFixed(1)} GPA</div></div>
        <div><div class="l">Subjects</div><div class="n">${subjects.length}</div></div>
        <div><div class="l">Class Rank</div><div class="n${rank<=3?' gold':''}">${rank}<small>${rankSuffix}</small></div><div class="s">of ${allStudents.length}</div></div>
      </div>
      <div class="rc-sec">Subject-wise performance</div>
      <table class="items">
        <thead><tr><th style="width:36px">Sl.</th><th>Subject</th><th class="r" style="width:70px">Max</th><th class="r" style="width:80px">Obtained</th><th style="width:150px">Performance</th><th style="width:56px;text-align:center">Grade</th><th style="width:56px;text-align:center">Result</th></tr></thead>
        <tbody>${subjectRows || '<tr><td colspan="7" style="text-align:center;color:#94A3B8">—</td></tr>'}</tbody>
      </table>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:-1px">
        <div class="stamp" style="border-color:${resColor}99;color:${resColor}cc;font-size:15px">${passed?"PASS":"FAIL"}<small>${rcEsc(grade.label)} · ${pct.toFixed(1)}%</small></div>
        <table class="tot" style="width:300px"><tbody>
          <tr><td class="k">Maximum Marks</td><td class="r mono">${courseMax}</td></tr>
          <tr><td class="k">Percentage</td><td class="r mono">${pct.toFixed(1)}%</td></tr>
          <tr class="net"><td>GRAND TOTAL</td><td class="r amt">${total} / ${courseMax}</td></tr>
        </tbody></table>
      </div>
      ${remarkBlock}
      <div class="foot" style="padding-top:34px">
        <div class="sig"><div class="line"></div><div class="l">Student's signature</div></div>
        <div class="sig"><div class="line"></div><div class="l">Class teacher</div></div>
        <div class="sig"><div class="line"></div><div class="l">Head of institute</div></div>
      </div>
    </div>`;
  return receiptSheet(receiptHeader('REPORT CARD', `${examName} · ${year}`) + body, undefined, "This is a computer-generated report card.");
}

// HTML-escape for report-card text (names, subjects, remarks come from the database)
const rcEsc = rcEscape;

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
    const html = buildReportCardHTML(st, subjects, subjectMaxMap, courseMax, marks, course, allStudents, examName, examDate, institute, remark);
    const title = `Report Card — ${st.name}`;
    openReceiptWindow(title, receiptDocument(title, html, { extraCss: REPORT_CARD_CSS, printLabel: "🖨 Print report card" }));
  };

  return (
    <div style={{ ...css.card, position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg,${grade.color},${grade.bg})` }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
        <div><div style={{ fontWeight: 700, fontSize: 15 }}>{st.name}</div><div style={{ fontSize: 11, color: "#8a93a6" }}>GCC {st.gcc_no} · {st.class_name}</div></div>
        <Badge label={grade.label} color={grade.color} bg={grade.bg} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
        <div style={{ textAlign: "center", padding: 8, background: "#faf8f3", borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: "#8a93a6", textTransform: "uppercase", letterSpacing: 1 }}>Total</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 600 }}>{total}<span style={{ fontSize: 11, color: "#8a93a6" }}>/{courseMax}</span></div>
        </div>
        <div style={{ textAlign: "center", padding: 8, background: "#faf8f3", borderRadius: 8 }}>
          <div style={{ fontSize: 10, color: "#8a93a6", textTransform: "uppercase", letterSpacing: 1 }}>Percentage</div>
          <div style={{ fontFamily: "'Playfair Display',serif", fontSize: 20, fontWeight: 600, color: grade.color }}>{pct.toFixed(1)}%</div>
        </div>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 4, textTransform: "uppercase" }}>Teacher's Remarks</label>
        <textarea value={remark} onChange={e => setRemark(e.target.value)} placeholder="Optional remark…"
          style={{ width: "100%", minHeight: 54, border: "1px solid #D1D5DB", borderRadius: 8, padding: "7px 10px", fontSize: 12, fontFamily: "'DM Sans',sans-serif", resize: "vertical", outline: "none" }} />
        <button onClick={() => saveRemark(remark)} style={{ ...css.btn, padding: "5px 12px", fontSize: 12, marginTop: 5, background: savedRemark ? "#E1F5EE" : "#eef2f9", color: savedRemark ? "#0F6E56" : "#1e3a6e", border: "1px solid " + (savedRemark ? "#BBF7D0" : "#c9d5ea") }}>
          {savingRemark ? "Saving…" : savedRemark ? "✓ Saved" : "💾 Save Remark"}
        </button>
      </div>
      <PrintReportCardButton onPrint={printReport} />
    </div>
  );
}

// Print button with a short "Opening…" state (its own component so the
// state hook isn't created inside an inline function during render).
function PrintReportCardButton({ onPrint }) {
  const [printing, setPrinting] = React.useState(false);
  return (
    <button onClick={() => { setPrinting(true); onPrint(); setTimeout(() => setPrinting(false), 3000); }} disabled={printing}
      style={{ ...css.btn, background: printing ? "#5d6b82" : "#132a4f", color: "white", width: "100%" }}>
      {printing ? "⏳ Opening…" : "🖨️ Print Report Card"}
    </button>
  );
}

// ─── REPORT CARDS TAB ─────────────────────────────────────────────────────────
function ReportCards({ courseSubjects, examTypes, students, institute, secondaryBatchMap }) {
  const isMobile = useMobile();
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  // ── Generic secondary-batch filter (any batch from student_secondary_batches,
  // not just Combined Navodaya) — lets staff print report cards scoped to just
  // the dual-appearing students under one secondary tag, e.g. "Combined
  // Navodaya Course(ENG)". "" means no secondary-batch filter is active and the
  // normal course/track picker below governs courseStudents as before.
  const secondaryBatches = listSecondaryBatches(secondaryBatchMap);
  const [secondaryBatchFilter, setSecondaryBatchFilter] = useState("");
  // Combined Navodaya students sit ENG or MM medium sections. Their marks/
  // schedule are stored under the ONE real course key below regardless of
  // section — ENG/MM is only a secondary-batch tag (see expandWithSecondary
  // Batches), which shows up as a phantom row with class_name set to one of
  // these two exact strings. So filtering by section here means matching
  // against these tag values directly, not against courseSubjects at all.
  const isCombinedNavodaya = course === "Combined Navodaya Course (Sainik Appearing Group)";
  const COMBINED_ENG_TAG = "Combined Navodaya Course(ENG)";
  const COMBINED_MM_TAG = "Combined Navodaya Course (MM)";
  const [combinedSection, setCombinedSection] = useState("ALL"); // "ALL" | "ENG" | "MM"
  const courseStudents = secondaryBatchFilter
    ? students.filter(s => normalizeSecondaryBatchSpelling(s.class_name) === secondaryBatchFilter)
    : students.filter(s => {
        if (!matchesCourseBatch(s, course)) return false;
        if (isCombinedNavodaya && combinedSection !== "ALL") {
          const tag = combinedSection === "ENG" ? COMBINED_ENG_TAG : COMBINED_MM_TAG;
          return s.class_name === tag;
        }
        return true;
      });
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
    setDatesLoaded(false);
    supabase.from("exam_marks").select("exam_date").eq("exam_type_id", examType).then(({ data }) => {
      const unique = [...new Set((data || []).map(r => r.exam_date))].sort().reverse();
      setDates(unique); if (unique.length) setExamDate(unique[0]); else setExamDate("");
      setDatesLoaded(true);
    });
  }, [examType]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
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
      <div style={{ ...css.card, background: "#faf8f3", marginBottom: 14 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setMarks({}); setCombinedSection("ALL"); setSecondaryBatchFilter(""); }} />
        {isCombinedNavodaya && (
          <div style={{ marginTop: 10 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Medium / Section</label>
            <div style={{ display: "flex", gap: 8 }}>
              {[["ALL", "All"], ["ENG", "English"], ["MM", "Manipuri (MM)"]].map(([val, label]) => (
                <button key={val} onClick={() => setCombinedSection(val)}
                  style={{ ...css.btn, padding: "6px 14px", background: combinedSection === val ? "#132a4f" : "#f3f0e8", color: combinedSection === val ? "white" : "#2e3b52", border: "1.5px solid " + (combinedSection === val ? "#132a4f" : "#e8e3d8") }}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        {secondaryBatches.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#92400E", marginBottom: 5, textTransform: "uppercase" }}>🔗 Or filter to a secondary batch</label>
            <select value={secondaryBatchFilter} onChange={e => setSecondaryBatchFilter(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 320, border: "1.5px solid #C9A24B" }}>
              <option value="">— None (use Batch/Course above) —</option>
              {secondaryBatches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 200 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select>
        </div>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Date</label>
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
        <div style={{ background: "#faf8f3", border: "1px solid #E5E7EB", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#5d6b82" }}>
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
function BulkReports({ courseSubjects, examTypes, students, institute, schedule, secondaryBatchMap }) {
  const isMobile = useMobile();
  const courses = Object.keys(courseSubjects);
  const [activeSection, setActiveSection] = useState("reportcard");
  // ── Generic secondary-batch filter, shared by both the Report Card and
  // Admit Card sub-tabs below — see the same block's comment in ReportCards.
  const secondaryBatches = listSecondaryBatches(secondaryBatchMap);
  const [rcSecondaryBatchFilter, setRcSecondaryBatchFilter] = useState("");
  const [acSecondaryBatchFilter, setAcSecondaryBatchFilter] = useState("");

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
  // Section-aware matching (handles "Combined Navodaya ... ENG/MAN" buttons)
  // is done via the shared top-level matchesCourseBatch() — see its comment
  // near the top of the file for why a plain class_name equality check isn't
  // enough for these.
  const rcStudents = rcSecondaryBatchFilter ? students.filter(s => normalizeSecondaryBatchSpelling(s.class_name) === rcSecondaryBatchFilter) : students.filter(s => matchesCourseBatch(s, rcCourse));
  const acStudents = acSecondaryBatchFilter ? students.filter(s => normalizeSecondaryBatchSpelling(s.class_name) === acSecondaryBatchFilter) : students.filter(s => matchesCourseBatch(s, acCourse));
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
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
    try { await supabase.from('exam_print_log').insert({ doc_type:'report_card', course:rcCourse, exam_type:examTypes.find(e=>e.id===rcExamType)?.name||'', student_count:filteredRcStudents.length }); } catch { /* ignore */ }
    const cards = [];
    for (let i = 0; i < filteredRcStudents.length; i++) {
      const st = filteredRcStudents[i];
      const remark = rcIncludeRemarks ? (rcRemarks[st.id] || "") : "";
      cards.push(buildReportCardHTML(st, rcSubjects, rcSubjectMaxMap, rcCourseMax, rcMarks, rcCourse, rankingPoolRcStudents, examTypes.find(e=>e.id===rcExamType)?.name||"Examination", rcExamDate, institute, remark));
      setRcProgress({ current: i+1, total: filteredRcStudents.length });
      await new Promise(r => setTimeout(r, 0));
    }
    const title = `Bulk Report Cards — ${rcCourse}`;
    w.document.open();
    w.document.write(receiptDocument(title, cards.join(''), { extraCss: REPORT_CARD_CSS, printLabel: `🖨 Print all (${cards.length}) report cards` }));
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
    try { await supabase.from('exam_print_log').insert({ doc_type:'admit_card', course:acCourse, exam_type:acExamName, student_count:filteredAcStudents.length }); } catch { /* ignore */ }
    const cards = [];
    for (let i = 0; i < filteredAcStudents.length; i++) {
      cards.push(buildAdmitCardHTML(filteredAcStudents[i]));
      setAcProgress({ current: i+1, total: filteredAcStudents.length });
      await new Promise(r => setTimeout(r, 0));
    }
    w.document.open();
    { const t = `Bulk Admit Cards — ${acCourse}`; w.document.write(receiptDocument(t, cards.join(''), { extraCss: ADMIT_CARD_CSS, printLabel: `🖨 Print all (${cards.length}) admit cards` })); }
    w.document.close();
    setAcProgress(null);
  };

  // Responsive two-col
  const twoCols = { display: isMobile ? "flex" : "grid", flexDirection: "column", gridTemplateColumns: "300px 1fr", gap: isMobile ? 14 : 20 };

  return (
    <div>
      <div style={{ display:"flex", gap:12, marginBottom:20 }}>
        <SectionBtn activeSection={activeSection} setActiveSection={setActiveSection} isMobile={isMobile} id="reportcard" icon="📋" label="Bulk Report Cards" count={rcStudents.length} />
        <SectionBtn activeSection={activeSection} setActiveSection={setActiveSection} isMobile={isMobile} id="admitcard"  icon="🪪"  label="Bulk Admit Cards"  count={acStudents.length} />
      </div>

      {activeSection === "reportcard" && (
        <div style={twoCols}>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", overflow:"hidden" }}>
              <div style={{ padding:"12px 18px", background:"#132a4f", color:"white", fontWeight:700, fontSize:13 }}>⚙️ Report Card Settings</div>
              <div style={{ padding:18, display:"flex", flexDirection:"column", gap:14 }}>
                <div>
                  <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5d6b82", marginBottom:6, textTransform:"uppercase" }}>Batch / Course</label>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                    {courses.map(c => <button key={c} onClick={()=>{setRcCourse(c); setRcSecondaryBatchFilter("");}} style={{ ...css.btn, padding:"4px 10px", fontSize:11, background:rcCourse===c?"#132a4f":"#f3f0e8", color:rcCourse===c?"white":"#2e3b52", border:rcCourse===c?"none":"1px solid #E5E7EB" }}>{c}</button>)}
                  </div>
                </div>
                {secondaryBatches.length > 0 && (
                  <div>
                    <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#92400E", marginBottom:6, textTransform:"uppercase" }}>🔗 Or Secondary Batch</label>
                    <select value={rcSecondaryBatchFilter} onChange={e=>setRcSecondaryBatchFilter(e.target.value)} style={{ ...css.input, border:"1.5px solid #C9A24B" }}>
                      <option value="">— None (use Batch/Course above) —</option>
                      {secondaryBatches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                )}
                <div><label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5d6b82", marginBottom:5, textTransform:"uppercase" }}>Exam Type</label>
                  <select value={rcExamType} onChange={e=>setRcExamType(e.target.value)} style={css.input}>{examTypes.map(et=><option key={et.id} value={et.id}>{et.name}</option>)}</select></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5d6b82", marginBottom:5, textTransform:"uppercase" }}>Date</label>
                  <select value={rcExamDate} onChange={e=>setRcExamDate(e.target.value)} style={css.input}>{rcDates.map(d=><option key={d} value={d}>{d}</option>)}</select></div>
                <div style={{ height:1, background:"#f3f0e8" }} />
                <div>
                  <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5d6b82", marginBottom:6, textTransform:"uppercase" }}>Filter Students</label>
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
                <div><label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5d6b82", marginBottom:6, textTransform:"uppercase" }}>Sort By</label>
                  <select value={rcSortBy} onChange={e=>setRcSortBy(e.target.value)} style={css.input}><option value="name">Name (A–Z)</option><option value="rank">Rank</option><option value="gcc">GCC No.</option></select></div>
                <div><input placeholder="Search name or GCC…" value={rcSearch} onChange={e=>setRcSearch(e.target.value)} style={css.input} /></div>
                <div style={{ height:1, background:"#f3f0e8" }} />
                <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, cursor:"pointer" }}><input type="checkbox" checked={rcIncludeRemarks} onChange={e=>setRcIncludeRemarks(e.target.checked)} />Include teacher remarks</label>
                <label style={{ display:"flex", alignItems:"center", gap:8, fontSize:13, cursor:"pointer" }}><input type="checkbox" checked={rcPageBreak} onChange={e=>setRcPageBreak(e.target.checked)} />Page break between cards</label>
              </div>
            </div>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4,1fr)", gap:10 }}>
              <StatPill label="Total"   value={rcStudents.length}          color="#132a4f" />
              <StatPill label="Will Print" value={filteredRcStudents.length}  color="#185FA5" />
              <StatPill label="Passed"  value={rankingPoolRcStudents.filter(s=>getPct(s.id)>=40).length} color="#0F6E56" />
              <StatPill label="Failed"  value={rankingPoolRcStudents.filter(s=>getPct(s.id)<40 && getTotal(s.id)>0).length} color="#A32D2D" />
              {absentRcCount > 0 && <StatPill label="Absent" value={absentRcCount} color="#DC2626" />}
            </div>
            <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", padding:18 }}>
              {rcProgress ? (
                <div style={{ textAlign:"center", padding:"20px 0" }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"#132a4f", marginBottom:12 }}>⏳ Generating {rcProgress.current}/{rcProgress.total} cards…</div>
                  <div style={{ height:8, background:"#f3f0e8", borderRadius:999, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${(rcProgress.current/rcProgress.total)*100}%`, background:"#132a4f", borderRadius:999, transition:"width .2s" }} />
                  </div>
                </div>
              ) : (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:14, flexWrap:"wrap" }}>
                  <div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:600, color:"#14213d", marginBottom:4 }}>Ready to print {filteredRcStudents.length} report cards</div>
                    <div style={{ fontSize:12, color:"#8a93a6" }}>{rcCourse} · {examTypes.find(e=>e.id===rcExamType)?.name} · {rcExamDate}</div>
                  </div>
                  <button onClick={printAllReportCards} disabled={!filteredRcStudents.length || rcLoading}
                    style={{ ...css.btn, background:"#132a4f", color:"white", padding:"12px 24px", fontSize:13, whiteSpace:"nowrap" }}>
                    🖨️ Print All {filteredRcStudents.length}
                  </button>
                </div>
              )}
            </div>
            <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", overflow:"hidden" }}>
              <div style={{ padding:"12px 18px", background:"#132a4f", color:"white", fontWeight:700, fontSize:13, display:"flex", justifyContent:"space-between" }}>
                <span>📋 Print Queue</span><span style={{ opacity:0.7, fontSize:12 }}>{filteredRcStudents.length} cards</span>
              </div>
              <div style={{ maxHeight:320, overflowY:"auto", overflowX:"auto" }}>
                <table className="gx-rt" style={{ width:"100%", borderCollapse:"collapse", fontSize:12, minWidth: isMobile ? 380 : "auto" }}>
                  <thead style={{ position:"sticky", top:0 }}>
                    <tr style={{ background:"#faf8f3", borderBottom:"2px solid #E5E7EB" }}>
                      {["#","GCC","Student","Total","%","Grade"].map(h=><th key={h} style={{ padding:"9px 10px", textAlign:h==="Student"?"left":"center", fontWeight:700, color:"#2e3b52", fontSize:11 }}>{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRcStudents.map((st,i)=>{
                      const total=getTotal(st.id); const pct=getPct(st.id); const g=getGrade(pct);
                      return <tr key={st.id} style={{ background:i%2?"#faf8f3":"white", borderBottom:"1px solid #F1F5F9" }}>
                        <td style={{ padding:"8px 10px", textAlign:"center", color:"#8a93a6", fontSize:11 }}>{i+1}</td>
                        <td style={{ padding:"8px 10px", textAlign:"center", fontWeight:700, color:"#132a4f" }}>{st.gcc_no}</td>
                        <td style={{ padding:"8px 10px", fontWeight:600 }}>{st.name}</td>
                        <td style={{ padding:"8px 10px", textAlign:"center", fontWeight:700 }}>{total}/{rcCourseMax}</td>
                        <td style={{ padding:"8px 10px", textAlign:"center", fontWeight:700, color:g.color }}>{pct.toFixed(1)}%</td>
                        <td style={{ padding:"8px 10px", textAlign:"center" }}><Badge label={g.label} color={g.color} bg={g.bg} /></td>
                      </tr>;
                    })}
                    {!filteredRcStudents.length && <tr><td colSpan={6} style={{ padding:32, textAlign:"center", color:"#8a93a6" }}>No students match filter.</td></tr>}
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
              <div style={{ padding:"12px 18px", background:"#132a4f", color:"white", fontWeight:700, fontSize:13 }}>⚙️ Admit Card Settings</div>
              <div style={{ padding:18, display:"flex", flexDirection:"column", gap:14 }}>
                <div>
                  <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5d6b82", marginBottom:6, textTransform:"uppercase" }}>Batch / Course</label>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                    {courses.map(c=><button key={c} onClick={()=>{setAcCourse(c); setAcSecondaryBatchFilter("");}} style={{ ...css.btn, padding:"4px 10px", fontSize:11, background:acCourse===c?"#132a4f":"#f3f0e8", color:acCourse===c?"white":"#2e3b52", border:acCourse===c?"none":"1px solid #E5E7EB" }}>{c}</button>)}
                  </div>
                </div>
                {secondaryBatches.length > 0 && (
                  <div>
                    <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#92400E", marginBottom:6, textTransform:"uppercase" }}>🔗 Or Secondary Batch</label>
                    <select value={acSecondaryBatchFilter} onChange={e=>setAcSecondaryBatchFilter(e.target.value)} style={{ ...css.input, border:"1.5px solid #C9A24B" }}>
                      <option value="">— None (use Batch/Course above) —</option>
                      {secondaryBatches.map(b => <option key={b} value={b}>{b}</option>)}
                    </select>
                  </div>
                )}
                <div><label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5d6b82", marginBottom:5, textTransform:"uppercase" }}>Exam Type</label>
                  <select value={acExamType} onChange={e=>setAcExamType(e.target.value)} style={css.input}>{examTypes.map(et=><option key={et.id} value={et.id}>{et.name}</option>)}</select></div>
                <div><label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5d6b82", marginBottom:6, textTransform:"uppercase" }}>Sort By</label>
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
              <StatPill label="Total Students" value={acStudents.length}        color="#132a4f" />
              <StatPill label="Will Print"     value={filteredAcStudents.length} color="#185FA5" />
              <StatPill label="Schedule Items" value={acSchedule.length}        color="#a7771f" />
            </div>
            <div style={{ background:"white", borderRadius:12, boxShadow:"0 2px 8px rgba(0,0,0,0.07)", padding:18 }}>
              {acProgress ? (
                <div style={{ textAlign:"center", padding:"20px 0" }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"#132a4f", marginBottom:12 }}>⏳ Generating {acProgress.current}/{acProgress.total} cards…</div>
                  <div style={{ height:8, background:"#f3f0e8", borderRadius:999, overflow:"hidden" }}>
                    <div style={{ height:"100%", width:`${(acProgress.current/acProgress.total)*100}%`, background:"#132a4f", borderRadius:999, transition:"width .2s" }} />
                  </div>
                </div>
              ) : (
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:14, flexWrap:"wrap" }}>
                  <div>
                    <div style={{ fontFamily:"'Playfair Display',serif", fontSize:17, fontWeight:600, color:"#14213d", marginBottom:4 }}>Ready to print {filteredAcStudents.length} admit cards</div>
                    <div style={{ fontSize:12, color:"#8a93a6" }}>{acCourse} · {acExamName}</div>
                  </div>
                  <button onClick={printAllAdmitCards} disabled={!filteredAcStudents.length}
                    style={{ ...css.btn, background:"#132a4f", color:"white", padding:"12px 24px", fontSize:13, whiteSpace:"nowrap" }}>
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
function AdmitCardsTab({ courseSubjects, examTypes, students, institute, schedule, onScheduleChange, secondaryBatchMap }) {
  const isMobile = useMobile();
  const courses = Object.keys(courseSubjects);
  const [course, setCourse] = useState(courses[0] || "");
  const [examType, setExamType] = useState(examTypes[0]?.id || "");
  const [search, setSearch] = useState("");
  const [populating, setPopulating] = useState(false);
  const [populateError, setPopulateError] = useState("");
  // ── Generic secondary-batch filter — see the same block's comment in
  // ReportCards for why courseSubjects/CoursePicker alone can't reach these.
  const secondaryBatches = listSecondaryBatches(secondaryBatchMap);
  const [secondaryBatchFilter, setSecondaryBatchFilter] = useState("");

  // Dropout students don't get admit cards for an upcoming sitting — same
  // convention as MarkEntry above. Their past admit cards/history aren't
  // affected since those were already generated/printed at the time.
  const courseStudents = (secondaryBatchFilter
    ? students.filter(s => normalizeSecondaryBatchSpelling(s.class_name) === secondaryBatchFilter)
    : students.filter(s => matchesCourseBatch(s, course))
  ).filter(s => s.status !== "Dropout");
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
      <div style={{ ...css.card, background: "#faf8f3", marginBottom: 14 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setSecondaryBatchFilter(""); }} />
        {secondaryBatches.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#92400E", marginBottom: 5, textTransform: "uppercase" }}>🔗 Or filter to a secondary batch</label>
            <select value={secondaryBatchFilter} onChange={e => setSecondaryBatchFilter(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 320, border: "1.5px solid #C9A24B" }}>
              <option value="">— None (use Batch/Course above) —</option>
              {secondaryBatches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: isMobile ? "100%" : 220 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select>
        </div>
        <div style={{ flex: isMobile ? "1 1 auto" : "none" }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#5d6b82", marginBottom: 5, textTransform: "uppercase" }}>Search</label>
          <input placeholder="Name or GCC…" value={search} onChange={e => setSearch(e.target.value)} style={css.input} />
        </div>
        <button onClick={printAll} style={{ ...css.btn, background: "#132a4f", color: "white", padding: "9px 20px", fontSize: isMobile ? 12 : 14, whiteSpace: "nowrap" }}>
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
                style={{ ...css.btn, padding: "7px 14px", fontSize: 12, background: populating ? "#b7c6e0" : "#132a4f", color: "white", whiteSpace: "nowrap" }}>
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
        <div style={{ padding: "12px 18px", background: "#132a4f", color: "white", fontWeight: 700, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
          <span>🪪 {course} — {examTypeName}</span>
          <span style={{ opacity: 0.7, fontSize: 12 }}>{filtered.length} students</span>
        </div>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table className="gx-rt" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: isMobile ? 380 : "auto" }}>
            <thead><tr style={{ background: "#faf8f3", borderBottom: "2px solid #E5E7EB" }}>
              {["GCC No.", "Student Name", "Batch", "Adm. No.", "Print"].map(h => (
                <th key={h} style={{ padding: "10px 12px", textAlign: h === "Student Name" ? "left" : "center", fontWeight: 700, color: "#2e3b52", fontSize: 11 }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((st, i) => (
                <tr key={st.id} style={{ background: i % 2 ? "#faf8f3" : "white", borderBottom: "1px solid #F1F5F9" }}>
                  <td style={{ padding: "9px 12px", textAlign: "center", fontWeight: 700, color: "#132a4f" }}>{st.gcc_no}</td>
                  <td style={{ padding: "9px 12px", fontWeight: 600, color: "#14213d" }}>{st.name}</td>
                  <td style={{ padding: "9px 12px", textAlign: "center" }}><span style={{ background: "#eef2f9", color: "#1e3a6e", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{st.class_name || "—"}</span></td>
                  <td style={{ padding: "9px 12px", textAlign: "center", color: "#8a93a6", fontSize: 12 }}>{st.admission_no || "—"}</td>
                  <td style={{ padding: "9px 12px", textAlign: "center" }}>
                    <button onClick={() => printOne(st)} style={{ ...css.btn, padding: "5px 12px", background: "#132a4f", color: "white", fontSize: 12 }}>🖨️</button>
                  </td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={5} style={{ padding: 32, textAlign: "center", color: "#8a93a6" }}>No students found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
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
      "LAKSHYA - A":   ["Grammar","Mental","Mathematics","Meitei Mayek"],
      "LAKSHYA - B":   ["Grammar","Mental","Mathematics","Meitei Mayek"],
      UMEED:     ["Grammar & Vocabulary","Mental","Mathematics","Meitei Mayek"],
      CHAMPION:  ["Vocabulary","General Knowledge","Mathematics-II","Mathematics - I","Reasoning","Grammar","Science"],
      LEADER:    ["Vocabulary","Grammar","General Knowledge","Mathematics -I","Mathematics - II","Reasoning","Science"],
    },
    courseMaxMarks: {
      ACHIEVER:  {"English Grammar":10,"Vocabulary":10,"General Knowledge":10,"Mathematics -I":20,"Mathematics - II":20,"Reasoning":20,"Science":10},
      ELITE:     {"English Grammar":20,"Science":15,"Mathematics":30,"Reasoning":20,"Meitei Mayek":15},
      PRIME:     {"English Grammar":20,"Science":15,"Mathematics":30,"Reasoning":20,"Meitei Mayek":15},
      LAKSHYA:   {"Grammar":20,"Mental":30,"Mathematics":30,"Meitei Mayek":20},
      "LAKSHYA - A":   {"Grammar":20,"Mental":30,"Mathematics":30,"Meitei Mayek":20},
      "LAKSHYA - B":   {"Grammar":20,"Mental":30,"Mathematics":30,"Meitei Mayek":20},
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
      "LAKSHYA - A":   ["Mathematics","Mental ability","Meitei Mayek / English Passage","English Grammar & Vocabulary"],
      "LAKSHYA - B":   ["Mathematics","Mental ability","Meitei Mayek / English Passage","English Grammar & Vocabulary"],
      UMEED:     ["Mathematics","Mental ability","Meitei Mayek / English Passage","English Grammar & Vocabulary"],
      ELITE:     ["Mathematics","Reasoning","English Grammar & Vocabulary","Meitei Mayek","Science"],
      PRIME:     ["Mathematics","Reasoning","English Grammar & Vocabulary","Meitei Mayek","Science"],
    },
    courseMaxMarks: {
      ACHIEVER:  {"Mathematics -I":75,"Mathematics - II":75,"Reasoning":50,"English Grammar":30,"Vocabulary":20,"Science":20,"General Knowledge":30},
CHAMPION:  {"Mathematics -I":75,"Mathematics - II":75,"Reasoning":50,"English Grammar":30,"Vocabulary":20,"Science":20,"General Knowledge":30},
LEADER:    {"Mathematics -I":75,"Mathematics - II":75,"Reasoning":50,"English Grammar":30,"Vocabulary":20,"Science":20,"General Knowledge":30},
      LAKSHYA:   {"Mathematics":30,"Mental ability":30,"Meitei Mayek / English Passage":20,"English Grammar & Vocabulary":20},
      "LAKSHYA - A":   {"Mathematics":30,"Mental ability":30,"Meitei Mayek / English Passage":20,"English Grammar & Vocabulary":20},
      "LAKSHYA - B":   {"Mathematics":30,"Mental ability":30,"Meitei Mayek / English Passage":20,"English Grammar & Vocabulary":20},
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
      "LAKSHYA - A":   ["Mathematics","Mental ability","Meitei Mayek / English Passage","English Grammar & Vocabulary"],
      "LAKSHYA - B":   ["Mathematics","Mental ability","Meitei Mayek / English Passage","English Grammar & Vocabulary"],
      UMEED:     ["Mathematics","Mental ability","Meitei Mayek / English Passage","English Grammar & Vocabulary"],
      ELITE:     ["Mathematics","Reasoning","English Grammar & Vocabulary","Meitei Mayek","Science"],
      PRIME:     ["Mathematics","Reasoning","English Grammar & Vocabulary","Meitei Mayek","Science"],
    },
    courseMaxMarks: {
      ACHIEVER:  {"Mathematics -I":75,"Mathematics - II":75,"Reasoning":50,"English Grammar":30,"Vocabulary":20,"Science":20,"General Knowledge":30},
      CHAMPION:  {"Mathematics -I":75,"Mathematics - II":75,"Reasoning":50,"English Grammar":30,"Vocabulary":20,"Science":20,"General Knowledge":30},
      LEADER:    {"Mathematics -I":75,"Mathematics - II":75,"Reasoning":50,"English Grammar":30,"Vocabulary":20,"Science":20,"General Knowledge":30},
      LAKSHYA:   {"Mathematics":30,"Mental ability":30,"Meitei Mayek / English Passage":20,"English Grammar & Vocabulary":20},
      "LAKSHYA - A":   {"Mathematics":30,"Mental ability":30,"Meitei Mayek / English Passage":20,"English Grammar & Vocabulary":20},
      "LAKSHYA - B":   {"Mathematics":30,"Mental ability":30,"Meitei Mayek / English Passage":20,"English Grammar & Vocabulary":20},
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
      "LAKSHYA - A":   ["Mathematics","Mental ability","Meitei Mayek / English Passage","English Grammar & Vocabulary"],
      "LAKSHYA - B":   ["Mathematics","Mental ability","Meitei Mayek / English Passage","English Grammar & Vocabulary"],
      UMEED:     ["Mathematics","Mental ability","Meitei Mayek / English Passage","English Grammar & Vocabulary"],
      ELITE:     ["Mathematics","Reasoning","English Grammar & Vocabulary","Meitei Mayek","Science"],
      PRIME:     ["Mathematics","Reasoning","English Grammar & Vocabulary","Meitei Mayek","Science"],
    },
    courseMaxMarks: {
      ACHIEVER:  {"Mathematics -I":75,"Mathematics - II":75,"Reasoning":50,"English Grammar":30,"Vocabulary":20,"Science":20,"General Knowledge":30},
      CHAMPION:  {"Mathematics -I":75,"Mathematics - II":75,"Reasoning":50,"English Grammar":30,"Vocabulary":20,"Science":20,"General Knowledge":30},
      LEADER:    {"Mathematics -I":75,"Mathematics - II":75,"Reasoning":50,"English Grammar":30,"Vocabulary":20,"Science":20,"General Knowledge":30},
      LAKSHYA:   {"Mathematics":30,"Mental ability":30,"Meitei Mayek / English Passage":20,"English Grammar & Vocabulary":20},
      "LAKSHYA - A":   {"Mathematics":30,"Mental ability":30,"Meitei Mayek / English Passage":20,"English Grammar & Vocabulary":20},
      "LAKSHYA - B":   {"Mathematics":30,"Mental ability":30,"Meitei Mayek / English Passage":20,"English Grammar & Vocabulary":20},
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
      "LAKSHYA - A":   ["Mathematics I","Mathematics II","Mental ability","Meitei Mayek / English Passage","EVS"],
      "LAKSHYA - B":   ["Mathematics I","Mathematics II","Mental ability","Meitei Mayek / English Passage","EVS"],
      UMEED:     ["Mathematics I","Mathematics II","Mental ability","Meitei Mayek / English Passage","EVS"],
      ELITE:     ["Mathematics","Reasoning","English Grammar & Vocabulary","Meitei Mayek","Science"],
      PRIME:     ["Mathematics","Reasoning","English Grammar & Vocabulary","Meitei Mayek","Science"],
    },
    courseMaxMarks: {
      ACHIEVER:  {"Mathematics I":75,"Mathematics II":75,"Reasoning":50,"English Grammar & Vocabulary":50,"General Knowledge & Science":50},
      CHAMPION:  {"Mathematics I":75,"Mathematics II":75,"Reasoning":50,"English Grammar & Vocabulary":50,"General Knowledge & Science":50},
      LEADER:    {"Mathematics I":75,"Mathematics II":75,"Reasoning":50,"English Grammar & Vocabulary":50,"General Knowledge & Science":50},
      LAKSHYA:   {"Mathematics I":20,"Mathematics II":20,"Mental ability":20,"Meitei Mayek / English Passage":20,"EVS":20},
      "LAKSHYA - A":   {"Mathematics I":20,"Mathematics II":20,"Mental ability":20,"Meitei Mayek / English Passage":20,"EVS":20},
      "LAKSHYA - B":   {"Mathematics I":20,"Mathematics II":20,"Mental ability":20,"Meitei Mayek / English Passage":20,"EVS":20},
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
    setCourseData(data);
    setSelectedCourses(new Set(Object.keys(src.courseSubjects)));
    setExamMode(src.examMode || "Written");
    setSessions(src.sessions?.length ? src.sessions.map(s => ({ ...s })) : [{ label: "Session I", time: "" }]);
  }, [copyFrom]);

  // Ensure courseData has entry for every selected course
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
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

  // ── STEP 1 ──────────────────────────────────────────────────────────────
  const Step1 = () => (
    <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
      <div>
        <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5d6b82", marginBottom:5, textTransform:"uppercase" }}>Exam Name *</label>
        <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. 3rd Monthly Test — August 2026" style={{ ...css.input, fontSize:15 }} />
      </div>
      <div>
        <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5d6b82", marginBottom:5, textTransform:"uppercase" }}>Short Description</label>
        <input value={description} onChange={e=>setDesc(e.target.value)} placeholder="e.g. OMR-based · August 2026" style={css.input} />
      </div>
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap:12 }}>
        <div>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5d6b82", marginBottom:5, textTransform:"uppercase" }}>Exam Date</label>
          <input type="date" value={examDate} onChange={e=>setExamDate(e.target.value)} style={css.input} />
        </div>
        <div>
          <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5d6b82", marginBottom:5, textTransform:"uppercase" }}>Exam Mode</label>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            {["Written","OMR","Online","Oral"].map(m => (
              <button key={m} onClick={() => setExamMode(m)}
                style={{ ...css.btn, padding:"7px 16px", fontSize:12, background:examMode===m?"#132a4f":"#f3f0e8", color:examMode===m?"white":"#2e3b52", border:examMode===m?"none":"1px solid #E5E7EB" }}>
                {m}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Hide "copy from" in edit mode — user is already editing an existing one */}
      {!isEdit && (
        <>
          <div style={{ height:1, background:"#f3f0e8" }} />
          <div>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5d6b82", marginBottom:8, textTransform:"uppercase" }}>
              Copy from existing format <span style={{ fontWeight:400, color:"#8a93a6" }}>(optional)</span>
            </label>
            <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(200px,1fr))", gap:8 }}>
              <div onClick={() => setCopyFrom("")}
                style={{ padding:"10px 14px", borderRadius:10, border: !copyFrom?"2px solid #132a4f":"1px solid #E5E7EB", background: !copyFrom?"#E1F5EE":"#faf8f3", cursor:"pointer" }}>
                <div style={{ fontWeight:700, fontSize:12, color: !copyFrom?"#0F6E56":"#2e3b52" }}>Start fresh</div>
                <div style={{ fontSize:11, color:"#8a93a6", marginTop:2 }}>Define everything from scratch</div>
              </div>
              {EXAM_CONFIG_PRESETS.map(p => (
                <div key={p.id} onClick={() => setCopyFrom(p.id)}
                  style={{ padding:"10px 14px", borderRadius:10, border: copyFrom===p.id?"2px solid #132a4f":"1px solid #E5E7EB", background: copyFrom===p.id?"#E1F5EE":"#faf8f3", cursor:"pointer" }}>
                  <div style={{ fontWeight:700, fontSize:12, color: copyFrom===p.id?"#0F6E56":"#2e3b52" }}>{p.name}</div>
                  <div style={{ fontSize:11, color:"#8a93a6", marginTop:2 }}>{p.description || "Built-in preset"}</div>
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
      <div style={{ fontSize:13, color:"#5d6b82" }}>Select which courses/batches this exam applies to.</div>
      <div style={{ display:"flex", gap:8, marginBottom:4 }}>
        <button onClick={() => setSelectedCourses(new Set(allCourses))} style={{ ...css.btn, padding:"5px 12px", fontSize:11, background:"#eef2f9", color:"#1e3a6e" }}>Select All</button>
        <button onClick={() => setSelectedCourses(new Set())} style={{ ...css.btn, padding:"5px 12px", fontSize:11, background:"#FEF2F2", color:"#DC2626" }}>Clear All</button>
      </div>
      <div style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(auto-fill,minmax(160px,1fr))", gap:10 }}>
        {allCourses.map(c => {
          const sel = selectedCourses.has(c);
          const subCount = courseData[c]?.subjects?.length || courseSubjects[c]?.length || 0;
          return (
            <div key={c} onClick={() => toggleCourse(c)}
              style={{ padding:"14px 16px", borderRadius:12, border: sel?"2px solid #132a4f":"1.5px solid #E5E7EB", background: sel?"#E1F5EE":"#faf8f3", cursor:"pointer", transition:"all .15s", position:"relative" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div style={{ fontWeight:700, fontSize:14, color: sel?"#0F6E56":"#2e3b52" }}>{c}</div>
                <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                  <button onClick={e => { e.stopPropagation(); setRenamingCourse(c); }} title={`Rename "${c}" everywhere (students, schedule, marks, configs)`}
                    style={{ ...css.btn, padding:"2px 6px", fontSize:11, background: sel?"#0F6E56":"#e8e3d8", color: sel?"white":"#5d6b82", border:"none" }}>
                    ✏️
                  </button>
                  <div style={{ width:20, height:20, borderRadius:"50%", background: sel?"#0F6E56":"#e8e3d8", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, color:"white", fontWeight:700, flexShrink:0 }}>
                    {sel ? "✓" : ""}
                  </div>
                </div>
              </div>
              <div style={{ fontSize:11, color:"#8a93a6", marginTop:4 }}>{subCount} subjects</div>
            </div>
          );
        })}
      </div>
      <div style={{ background:"#faf8f3", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#5d6b82" }}>
        {selectedCourses.size} course{selectedCourses.size !== 1 ? "s" : ""} selected: <b style={{ color:"#132a4f" }}>{[...selectedCourses].join(", ") || "none"}</b>
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
          <div style={{ fontSize:11, fontWeight:700, color:"#5d6b82", textTransform:"uppercase", marginBottom:8 }}>Courses</div>
          <div style={{ display:"flex", flexDirection: isMobile ? "row" : "column", flexWrap:"wrap", gap:5 }}>
            {courseArr.map(c => {
              const cd = courseData[c] || { subjects:[], marks:{} };
              const ok = cd.subjects.length > 0;
              return (
                <div key={c} style={{ display:"flex", alignItems:"stretch", gap:0 }}>
                  <button onClick={() => setActiveCourse(c)}
                    style={{ ...css.btn, padding:"8px 12px", textAlign:"left", fontSize:12, flex:1,
                      background: activeCourse===c?"#132a4f":"#faf8f3",
                      color: activeCourse===c?"white":"#2e3b52",
                      border: activeCourse===c?"none": ok?"1px solid #BBF7D0":"1px solid #E5E7EB",
                      borderRadius: "8px 0 0 8px",
                      display:"flex", justifyContent:"space-between", alignItems:"center", gap:8 }}>
                    <span>{c}</span>
                    <span style={{ fontSize:10, opacity:0.75 }}>{ok ? `${cd.subjects.length}s` : "⚠️"}</span>
                  </button>
                  <button onClick={() => setRenamingCourse(c)} title={`Rename "${c}" everywhere (students, schedule, marks, configs)`}
                    style={{ ...css.btn, padding:"8px 8px", fontSize:11, borderRadius:"0 8px 8px 0",
                      background: activeCourse===c?"#14532d":"#e8e3d8",
                      color: activeCourse===c?"white":"#5d6b82",
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
            <div style={{ fontWeight:700, fontSize:15, color:"#132a4f" }}>{activeCourse}</div>
            <div style={{ display:"flex", gap:6, alignItems:"center" }}>
              <span style={{ fontSize:11, color: total===getTarget(activeCourse)?"#0F6E56":total>getTarget(activeCourse)?"#DC2626":"#8a93a6", fontWeight:700 }}>
                Total: {total} / {getTarget(activeCourse)}
              </span>
              <button onClick={() => autoSplitMarks(activeCourse, getTarget(activeCourse))}
                style={{ ...css.btn, padding:"4px 10px", fontSize:11, background:"#eef2f9", color:"#1e3a6e", border:"1px solid #BFDBFE" }}>
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
              style={{ ...css.btn, background:"#132a4f", color:"white", whiteSpace:"nowrap" }}>+ Add</button>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
            {d.subjects.map((sub, i) => (
              <div key={sub} style={{ display:"flex", alignItems:"center", gap:8, padding:"9px 12px", background: i%2?"#faf8f3":"white", borderRadius:8, border:"1px solid #F1F5F9" }}>
                <div style={{ fontSize:10, color:"#d9d2c2", fontWeight:700, width:18, flexShrink:0 }}>{i+1}</div>
                {editingSub === `name-${activeCourse}-${sub}` ? (
                  <input type="text" autoFocus defaultValue={sub}
                    style={{ flex:1, fontSize:13, fontWeight:600, color:"#14213d", padding:"4px 8px", borderRadius:6, border:"1.5px solid #6366f1", outline:"none" }}
                    onBlur={e => { renameSubject(activeCourse, sub, e.target.value); setEditingSub(null); }}
                    onKeyDown={e => {
                      if (e.key === "Enter") { renameSubject(activeCourse, sub, e.target.value); setEditingSub(null); }
                      if (e.key === "Escape") setEditingSub(null);
                    }} />
                ) : (
                  <div onClick={() => setEditingSub(`name-${activeCourse}-${sub}`)} title="Click to edit subject name"
                    style={{ flex:1, fontSize:13, fontWeight:600, color:"#14213d", cursor:"pointer", padding:"4px 8px", borderRadius:6 }}>
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
                    style={{ width:70, textAlign:"center", padding:"4px 8px", borderRadius:6, border:"1px solid #E5E7EB", fontSize:13, fontWeight:700, color: d.marks[sub]?"#132a4f":"#d9d2c2", cursor:"pointer", background:"#faf8f3" }}>
                    {d.marks[sub] || "—"}
                  </div>
                )}
                <span style={{ fontSize:11, color:"#8a93a6" }}>marks</span>
                <button onClick={() => removeSubject(activeCourse, sub)}
                  style={{ ...css.btn, padding:"3px 8px", background:"#FEF2F2", color:"#DC2626", border:"1px solid #FECACA", fontSize:11 }}>✕</button>
              </div>
            ))}
            {!d.subjects.length && (
              <div style={{ padding:"24px 0", textAlign:"center", color:"#d9d2c2", fontSize:13 }}>
                No subjects yet. Add subjects above.
              </div>
            )}
          </div>

          <div style={{ marginTop:14, display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
            <span style={{ fontSize:11, color:"#8a93a6", fontWeight:700 }}>Copy from:</span>
            {[...selectedCourses].filter(c => c !== activeCourse).map(c => (
              <button key={c} onClick={() => {
                const src = courseData[c];
                if (!src) return;
                setCourseData(prev => ({
                  ...prev,
                  [activeCourse]: { subjects:[...src.subjects], marks:{...src.marks} }
                }));
              }} style={{ ...css.btn, padding:"3px 10px", fontSize:11, background:"#f3f0e8", color:"#2e3b52", border:"1px solid #E5E7EB" }}>
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
      <div style={{ fontSize:13, color:"#5d6b82" }}>Define exam sessions (optional). These appear on admit cards and the schedule.</div>
      {sessions.map((s, i) => (
        <div key={i} style={{ display:"grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr auto", gap:10, alignItems:"flex-end", padding:"12px 14px", background:"#faf8f3", borderRadius:10, border:"1px solid #E5E7EB" }}>
          <div>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5d6b82", marginBottom:4, textTransform:"uppercase" }}>Session Label</label>
            <input value={s.label} onChange={e=>updateSession(i,"label",e.target.value)} placeholder="e.g. Session I" style={css.input} />
          </div>
          <div>
            <label style={{ display:"block", fontSize:11, fontWeight:700, color:"#5d6b82", marginBottom:4, textTransform:"uppercase" }}>Time</label>
            <input value={s.time} onChange={e=>updateSession(i,"time",e.target.value)} placeholder="e.g. 10:15 AM – 12:45 PM" style={css.input} />
          </div>
          <button onClick={() => removeSession(i)} style={{ ...css.btn, padding:"8px 12px", background:"#FEF2F2", color:"#DC2626", border:"1px solid #FECACA", alignSelf:"flex-end" }}>✕</button>
        </div>
      ))}
      <button onClick={addSession} style={{ ...css.btn, background:"#eef2f9", color:"#1e3a6e", border:"1px solid #BFDBFE", fontSize:13 }}>+ Add Session</button>
      <div style={{ height:1, background:"#f3f0e8", margin:"4px 0" }} />
      <div style={{ fontWeight:700, fontSize:13, color:"#14213d", marginBottom:6 }}>📅 Evaluation Timeline <span style={{ fontWeight:400, fontSize:11, color:"#8a93a6" }}>(optional)</span></div>
      <EvaluationTimeline examDate={examDate} />
    </div>
  );

  // ── STEP 5 ──────────────────────────────────────────────────────────────
  const Step5 = () => {
    const courseArr = [...selectedCourses];
    return (
      <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
        <div style={{ background:"linear-gradient(135deg,#132a4f,#1e3a6e)", borderRadius:12, padding:"16px 20px", color:"white" }}>
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
                  <div style={{ fontWeight:700, color:"#132a4f", fontSize:13 }}>{c}</div>
                  <span style={{ fontSize:11, padding:"2px 8px", borderRadius:999, background: total===target?"#E1F5EE":total>target?"#FCEBEB":"#FFFBEB", color: total===target?"#0F6E56":total>target?"#DC2626":"#92400E", fontWeight:700 }}>
                    {total} marks
                  </span>
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:4 }}>
                  {d.subjects.map(s => (
                    <span key={s} style={{ fontSize:10, padding:"2px 8px", background:"#f3f0e8", borderRadius:999, color:"#4b5870" }}>
                      {s}{d.marks[s] ? <span style={{ color:"#8a93a6", marginLeft:2 }}>/{d.marks[s]}</span> : null}
                    </span>
                  ))}
                  {!ok && <span style={{ fontSize:11, color:"#DC2626" }}>⚠️ No subjects defined</span>}
                </div>
              </div>
            );
          })}
        </div>

        {sessions.filter(s=>s.time).length > 0 && (
          <div style={{ background:"#faf8f3", borderRadius:10, padding:"12px 16px", border:"1px solid #E5E7EB" }}>
            <div style={{ fontWeight:700, fontSize:12, color:"#5d6b82", textTransform:"uppercase", marginBottom:8 }}>Sessions</div>
            {sessions.map((s,i) => (
              <div key={i} style={{ fontSize:13, color:"#2e3b52", marginBottom:4 }}>
                <b>{s.label}</b>{s.time ? ` · ${s.time}` : ""}
              </div>
            ))}
          </div>
        )}

        <div style={{ background:"#eef2f9", border:"1px solid #BFDBFE", borderRadius:8, padding:"10px 14px", fontSize:12, color:"#1e3a6e" }}>
          ℹ️ {isEdit ? "Changes will be saved. Click Activate on the config list if you want to apply it now." : "Once created, go to the config list and click Activate to apply this format across all tabs."}
        </div>
      </div>
    );
  };

  const stepFns = [Step1, Step2, Step3, Step4, Step5];
  const stepTitles  = ["Basic Information", "Select Courses", "Subjects & Marks", "Exam Sessions", "Review & " + (isEdit ? "Save" : "Create")];

  return (
    <div style={{ background:"white", borderRadius:14, boxShadow:"0 2px 16px rgba(0,0,0,0.09)", overflow:"hidden" }}>
      <div style={{ background:"linear-gradient(135deg,#132a4f,#1e3a6e)", padding:"18px 24px" }}>
        <div style={{ fontFamily:"'Playfair Display',serif", fontSize:18, color:"white", marginBottom:2 }}>
          {isEdit ? "✏️ Edit Exam Format" : "✏️ Exam Format Builder"}
        </div>
        <div style={{ fontSize:12, color:"rgba(255,255,255,0.6)" }}>Step {step} of {TOTAL_STEPS} — {stepTitles[step-1]}</div>
      </div>

      <div style={{ padding: isMobile ? "16px 14px" : "24px 28px" }}>
        <StepBar step={step} setStep={setStep} isMobile={isMobile} />
        {stepFns[step - 1]()}
        <NavButtons step={step} setStep={setStep} totalSteps={TOTAL_STEPS} canNext={canNext} handleSave={handleSave} saving={saving} isEdit={isEdit} />
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
        <button onClick={onCancel} style={{ ...css.btn, background:"none", color:"#8a93a6", fontSize:12, border:"none" }}>✕ Cancel and go back</button>
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
        <button onClick={autoFill} style={{ ...css.btn, padding:"5px 14px", fontSize:11, background:"#eef2f9", color:"#1e3a6e", border:"1px solid #BFDBFE", marginBottom:10 }}>
          ⚡ Auto-fill from exam date ({examDate})
        </button>
      )}
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {rows.map((r,i) => (
          <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, alignItems:"center" }}>
            <div style={{ fontSize:12, color:"#2e3b52", fontWeight:600 }}>{r.label}</div>
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
        <div style={{ background:"linear-gradient(135deg,#132a4f,#1e3a6e)", padding:"14px 20px",
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
            {cfg.examDate && <span style={{ fontSize:11, padding:"3px 12px", borderRadius:999, background:"#eef2f9", color:"#1e3a6e", fontWeight:700 }}>📅 {cfg.examDate}</span>}
            {cfg.examMode && <span style={{ fontSize:11, padding:"3px 12px", borderRadius:999, background:"#eef2f9", color:"#4338CA", fontWeight:700 }}>📝 {cfg.examMode}</span>}
            {cfg.sessions?.filter(s=>s.time).length > 0 &&
              <span style={{ fontSize:11, padding:"3px 12px", borderRadius:999, background:"#FFF7ED", color:"#C2410C", fontWeight:700 }}>
                ⏰ {cfg.sessions.length} Session{cfg.sessions.length>1?"s":""}
              </span>}
          </div>

          {/* Sessions table */}
          {cfg.sessions?.filter(s=>s.time).length > 0 && (
            <div style={{ marginBottom:22 }}>
              <div style={{ fontWeight:700, fontSize:12, color:"#5d6b82", textTransform:"uppercase", marginBottom:8, letterSpacing:".06em" }}>Exam Schedule</div>
              <table className="gx-rt" style={{ width:"100%", borderCollapse:"collapse", fontSize:13 }}>
                <thead>
                  <tr style={{ background:"#faf8f3" }}>
                    <th style={{ padding:"8px 12px", textAlign:"left", borderBottom:"2px solid #E5E7EB", color:"#132a4f", fontWeight:700 }}>Session</th>
                    <th style={{ padding:"8px 12px", textAlign:"left", borderBottom:"2px solid #E5E7EB", color:"#132a4f", fontWeight:700 }}>Timing</th>
                  </tr>
                </thead>
                <tbody>
                  {cfg.sessions.filter(s=>s.time).map((s,i) => (
                    <tr key={i} style={{ borderBottom:"1px solid #F1F5F9" }}>
                      <td style={{ padding:"8px 12px", fontWeight:600, color:"#2e3b52" }}>{s.label}</td>
                      <td style={{ padding:"8px 12px", color:"#5d6b82" }}>{s.time}</td>
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
                  background:"linear-gradient(90deg,#132a4f 0%,#1e3a6e 100%)",
                  borderRadius:"8px 8px 0 0", padding:"8px 14px" }}>
                  <div style={{ fontWeight:700, color:"white", fontSize:13 }}>{course}</div>
                  <div style={{ fontSize:11, color:"rgba(255,255,255,.75)", fontWeight:600 }}>Total: {total} marks</div>
                </div>
                <table className="gx-rt" style={{ width:"100%", borderCollapse:"collapse", fontSize:13, border:"1px solid #E5E7EB", borderTop:"none" }}>
                  <thead>
                    <tr style={{ background:"#faf8f3" }}>
                      <th style={{ padding:"7px 12px", textAlign:"left", color:"#5d6b82", fontWeight:700, fontSize:11, textTransform:"uppercase", width:36 }}>#</th>
                      <th style={{ padding:"7px 12px", textAlign:"left", color:"#5d6b82", fontWeight:700, fontSize:11, textTransform:"uppercase" }}>Subject</th>
                      <th style={{ padding:"7px 12px", textAlign:"center", color:"#5d6b82", fontWeight:700, fontSize:11, textTransform:"uppercase", width:90 }}>Max Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subs.map((sub, i) => (
                      <tr key={sub} style={{ borderBottom:"1px solid #F1F5F9", background: i%2?"#FAFAFA":"white" }}>
                        <td style={{ padding:"8px 12px", color:"#d9d2c2", fontWeight:700 }}>{i+1}</td>
                        <td style={{ padding:"8px 12px", color:"#14213d", fontWeight:500 }}>{sub}</td>
                        <td style={{ padding:"8px 12px", textAlign:"center", fontWeight:700,
                          color: marks[sub] ? "#132a4f" : "#d9d2c2" }}>
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetch effect: reset/loading flag before async load
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
  try { allConfigs = [...EXAM_CONFIG_PRESETS, ...JSON.parse(cfgData.value)]; } catch { /* ignore */ }
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
            <div style={{ fontSize:13, color:"#5d6b82", textAlign:"center", marginBottom:22 }}>
              Permanently delete <b>{configs.find(c=>c.id===deleteId)?.name}</b>?
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setDeleteId(null)} style={{ ...css.btn, flex:1, background:"#f3f0e8", color:"#2e3b52" }}>Cancel</button>
              <button onClick={() => handleDelete(deleteId)} style={{ ...css.btn, flex:1, background:"#DC2626", color:"white" }}>🗑️ Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Detail view modal (kept from v2) */}
      {viewCfg && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:1000, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"white", borderRadius:14, width:"100%", maxWidth:620, maxHeight:"88vh", overflowY:"auto", boxShadow:"0 8px 40px rgba(0,0,0,0.2)" }}>
            <div style={{ background:"linear-gradient(135deg,#132a4f,#1e3a6e)", padding:"16px 22px", display:"flex", justifyContent:"space-between", alignItems:"center", position:"sticky", top:0 }}>
              <div style={{ fontFamily:"'Playfair Display',serif", fontSize:16, color:"white" }}>{viewCfg.name}</div>
              <button onClick={() => setViewId(null)} style={{ background:"rgba(255,255,255,.15)", border:"none", borderRadius:6, padding:"4px 10px", color:"white", cursor:"pointer" }}>✕</button>
            </div>
            <div style={{ padding:22 }}>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:16 }}>
                {viewCfg.examDate && <span style={{ fontSize:11, padding:"3px 10px", borderRadius:999, background:"#eef2f9", color:"#1e3a6e", fontWeight:700 }}>📅 {viewCfg.examDate}</span>}
                {viewCfg.examMode && <span style={{ fontSize:11, padding:"3px 10px", borderRadius:999, background:"#eef2f9", color:"#4338CA", fontWeight:700 }}>📝 {viewCfg.examMode}</span>}
              </div>
              {viewCfg.sessions?.filter(s=>s.time).length > 0 && (
                <div style={{ background:"#faf8f3", borderRadius:8, padding:"10px 14px", marginBottom:14, border:"1px solid #E5E7EB" }}>
                  <div style={{ fontWeight:700, fontSize:11, color:"#5d6b82", textTransform:"uppercase", marginBottom:6 }}>Sessions</div>
                  {viewCfg.sessions.map((s,i)=>(
                    <div key={i} style={{ fontSize:12, color:"#2e3b52", marginBottom:3 }}><b>{s.label}</b>{s.time?` · ${s.time}`:""}</div>
                  ))}
                </div>
              )}
              {Object.entries(viewCfg.courseSubjects||{}).map(([c,subs])=>(
                <div key={c} style={{ marginBottom:12, background:"#faf8f3", borderRadius:10, padding:"10px 14px", border:"1px solid #E5E7EB" }}>
                  <div style={{ fontWeight:700, color:"#132a4f", fontSize:13, marginBottom:6 }}>
                    {c} <span style={{ fontWeight:400, color:"#8a93a6" }}>· {getTotalMarks(viewCfg,c)} marks</span>
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                    {subs.map(s=>(
                      <span key={s} style={{ fontSize:11, padding:"3px 10px", background:"#eef2f9", color:"#1e3a6e", borderRadius:999, fontWeight:600 }}>
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
          <p style={{ margin:"4px 0 0", fontSize:12, color:"#8a93a6" }}>{configs.length} formats available — {configs.find(c=>c.id===activeId)?.name || "none"} is active</p>
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
            style={{ ...css.btn, background:"#132a4f", color:"white", fontSize:13, padding:"10px 20px" }}>
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
              border: isActive ? "2px solid #132a4f" : "1.5px solid #E5E7EB",
              boxShadow: isActive ? "0 4px 16px rgba(19,42,79,0.12)" : "0 1px 4px rgba(0,0,0,0.06)",
              overflow:"hidden", position:"relative",
            }}>
              {isActive && <div style={{ position:"absolute", top:0, left:0, right:0, height:3, background:"linear-gradient(90deg,#132a4f,#1e3a6e,#b8923a)" }} />}
              <div style={{ padding:"16px 18px 10px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:6, gap:8 }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14, color:"#14213d" }}>{cfg.name}</div>
                    {cfg.description && <div style={{ fontSize:11, color:"#8a93a6", marginTop:1 }}>{cfg.description}</div>}
                  </div>
                  <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                    {isActive
                      ? <span style={{ fontSize:11, padding:"2px 9px", borderRadius:999, background:"#E1F5EE", color:"#0F6E56", fontWeight:700 }}>✓ Active</span>
                      : <span style={{ fontSize:11, padding:"2px 9px", borderRadius:999, background:"#f3f0e8", color:"#5d6b82" }}>Inactive</span>
                    }
                    {isPreset && <span style={{ fontSize:10, padding:"2px 7px", borderRadius:999, background:"#eef2f9", color:"#1e3a6e", fontWeight:700 }}>Built-in</span>}
                  </div>
                </div>

                <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:10 }}>
                  {cfg.examDate && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:999, background:"#eef2f9", color:"#4338CA", fontWeight:600 }}>📅 {cfg.examDate}</span>}
                  {cfg.examMode && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:999, background:"#fbf3e0", color:"#a7771f", fontWeight:600 }}>📝 {cfg.examMode}</span>}
                  {cfg.sessions?.length > 0 && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:999, background:"#FFF7ED", color:"#C2410C", fontWeight:600 }}>⏰ {cfg.sessions.length} session{cfg.sessions.length>1?"s":""}</span>}
                </div>

                <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:10 }}>
                  {courses.map(c => (
                    <div key={c} style={{ fontSize:11, padding:"3px 10px", borderRadius:999, background:"#faf8f3", border:"1px solid #E5E7EB", color:"#2e3b52" }}>
                      <span style={{ fontWeight:700, color:"#132a4f" }}>{c}</span>
                      <span style={{ color:"#8a93a6", marginLeft:3 }}>{getTotalMarks(cfg,c)}m</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Card actions ── */}
              <div style={{ display:"flex", gap:6, padding:"10px 14px 14px", borderTop:"1px solid #F1F5F9", flexWrap:"wrap" }}>

                {/* Preview (NEW) */}
                <button onClick={() => setPreviewCfg(cfg)}
                  style={{ ...css.btn, padding:"7px 10px", background:"#eef2f9", color:"#1e3a6e", border:"1px solid #BFDBFE", fontSize:12 }}>
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
  style={{ ...css.btn, padding:"7px 10px", background:"#fbf3e0", color:"#a7771f", border:"1px solid #DDD6FE", fontSize:12 }}>
  ✏️ Edit
</button>

                {/* Activate / active label */}
                {isActive
                  ? <div style={{ flex:1, textAlign:"center", fontSize:12, color:"#0F6E56", fontWeight:600, padding:"7px 0", minWidth:100 }}>✓ Active</div>
                  : <button onClick={() => handleSwitch(cfg)} disabled={switching}
                      style={{ ...css.btn, flex:1, minWidth:100, background:switching?"#b7c6e0":"#132a4f", color:"white", fontSize:13 }}>
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
      <div style={{ background:"#eef2f9", border:"1px solid #BFDBFE", borderRadius:10, padding:"14px 18px", fontSize:13, color:"#1e3a6e" }}>
        <div style={{ fontWeight:700, marginBottom:6 }}>ℹ️ What you can do</div>
        <div style={{ color:"#2e3b52", lineHeight:1.8 }}>
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
  const isPhone = useMobile();
  // On a phone the module opens on the app-style home grid; on desktop it opens on Mark Entry.
  const [tab, setTab]               = useState(() => (typeof window !== "undefined" && window.innerWidth < 768 ? "home" : "entry"));
  const [examConfigPrefillName, setExamConfigPrefillName] = useState("");
  const [students, setStudents]     = useState([]);
  const [examTypes, setExamTypes]   = useState([]);
  const [courseSubjects, setCourseSubjects] = useState(DEFAULT_COURSE_SUBJECTS);
  const [schedule, setSchedule]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [institute, setInstitute]   = useState(INSTITUTE_DEFAULT);
  const [activeConfigId, setActiveConfigId] = useState("default");
  // Full active config object (subjects/marks/sessions/examDate) — needed by
  // Schedule's "Auto-Generate from Active Config" and kept in sync whenever
  // the config is switched in ExamConfigManager. Previously only the ID was
  // tracked at this level (courseMaxMarks went through a window.* side
  // channel instead), so nothing up here could ever see the full active
  // config's sessions/examDate, and a page refresh lost track of which
  // config was even active until ExamConfigManager re-fetched it itself.
  const [activeExamConfig, setActiveExamConfig] = useState(null);
  useEffect(() => {
    (async () => {
      const [{ data: cfgData }, { data: actData }] = await Promise.all([
        supabase.from("system_settings").select("value").eq("key", "exam_configs").single(),
        supabase.from("system_settings").select("value").eq("key", "active_exam_config").single(),
      ]);
      let allConfigs = [...EXAM_CONFIG_PRESETS];
      if (cfgData?.value) {
        try { allConfigs = [...EXAM_CONFIG_PRESETS, ...JSON.parse(cfgData.value)]; } catch { /* ignore */ }
      }
      const savedId = actData?.value || "default";
      const cfg = allConfigs.find(c => c.id === savedId) || allConfigs[0];
      setActiveConfigId(savedId);
      setActiveExamConfig(cfg || null);
      if (cfg?.courseMaxMarks) window.__gnsiCourseMaxMarks = cfg.courseMaxMarks;
    })();
  }, []);
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
    // `students.class_name` is StudentDB's free-text "Class (optional)"
    // section field (e.g. "9A") and is unrelated to the exam batch group —
    // it must never be used for exam grouping/lookups. `students.batch`
    // (e.g. "Achiever", "Lakshya A") is the field StudentDB's Course/Batch
    // selects actually write the batch to, so that's the source of truth
    // here, translated to the exam-side spelling via batchToCourseSubjectsKey.
    const rawBatch = (s.course === "Combined Course" && (!s.batch || s.batch === "—"))
      ? COMBINED_COURSE_BATCH_LABEL
      : (s.batch || "");
    const batch = batchToCourseSubjectsKey(rawBatch);
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
      // ✦ Routed through studentQueries.js — was a plain, fully unfiltered
      // .select() (included dropout/soft-deleted students, and capped at
      // 1000 rows). Now active-only, matching Students.jsx's roster, so
      // exam rolls/mark entry/admit cards don't include students who've
      // left, and pagination-safe past 1000 students.
      const [sts, { data: types }, { data: csSetting }, { data: sched }, { data: instSetting }, { data: secBatches }] =
        await Promise.all([
          getActiveStudents("id,name,class_name,course,batch,admission_no,gcc_no,status"),
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
        } catch { /* ignore */ }
      }
      setSchedule(sched || []);
      if (instSetting?.value) { try { setInstitute({ ...INSTITUTE_DEFAULT, ...JSON.parse(instSetting.value) }); } catch { /* ignore */ } }
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
  }, [refetchSecondaryBatches]);
 
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#f7f5f0", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
    mockanalyzer:   () => <MockTestAnalyzer institute={institute} currentUser={currentUser}
                            canUpload={isAdminRole(currentUser?.role) || perms?.add === true || perms?.edit === true || ['Manager','Accounts','Accountant'].includes(currentUser?.role)}
                            canDelete={isAdminRole(currentUser?.role) || perms?.delete === true} />,
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
    reportcard:     () => <ReportCards courseSubjects={courseSubjects} examTypes={examTypes} students={examStudents} institute={institute} secondaryBatchMap={secondaryBatchMap} />,
    // ── SYNCED: Schedule now uses syncVersion and refetchSchedule ──
    schedule:       () => <Schedule key={syncVersion} courseSubjects={courseSubjects} examTypes={examTypes} onScheduleChange={refetchSchedule} activeExamConfig={activeExamConfig} />,
    seatplan:       () => <SeatArrangement courseSubjects={courseSubjects} examTypes={examTypes} students={examStudents} institute={institute} schedule={schedule} />,
    studentsmgr:    () => <StudentsTab courseSubjects={courseSubjects} students={students} examTypes={examTypes} onStudentsChange={setStudents} currentUser={currentUser} perms={perms} secondaryBatchMap={secondaryBatchMap} onSecondaryBatchesChange={refetchSecondaryBatches} />,
    // ── SYNCED: CourseSubjectsManager uses centralized handler ──
    coursesubjects: () => <CourseSubjectsManager key={syncVersion} courseSubjects={courseSubjects} onUpdate={handleCourseSubjectsUpdate} />,
    examtypes:      () => <ExamTypesManager examTypes={examTypes} onUpdate={setExamTypes} onSetupSchedule={(name) => { setExamConfigPrefillName(name); setTab("examconfig"); }} courseSubjects={courseSubjects} onScheduleChange={refetchSchedule} />,
    // ── SYNCED: ExamConfigManager notifies on config switch ──
    examconfig:     () => <ExamConfigManager key={syncVersion} courseSubjects={courseSubjects} onUpdate={handleCourseSubjectsUpdate} activeConfigId={activeConfigId} onConfigSwitch={(cfg) => { setActiveConfigId(cfg.id); setActiveExamConfig(cfg); window.__gnsiCourseMaxMarks = cfg.courseMaxMarks || {}; setSyncVersion(v => v + 1); }} prefillName={examConfigPrefillName} onPrefillConsumed={() => setExamConfigPrefillName("")} />,
    settings:       () => <ExamSettings institute={institute} onUpdateInstitute={setInstitute} />,
    progress:       () => <ProgressTab courseSubjects={courseSubjects} examTypes={examTypes} students={examStudents} />,
    compare:        () => <CompareTab courseSubjects={courseSubjects} examTypes={examTypes} students={examStudents} />,
    admitcard:      () => <AdmitCardsTab courseSubjects={courseSubjects} examTypes={examTypes} students={examStudents} institute={institute} schedule={schedule} onScheduleChange={refetchSchedule} secondaryBatchMap={secondaryBatchMap} />,
    bulkreport:     () => <BulkReports courseSubjects={courseSubjects} examTypes={examTypes} students={examStudents} institute={institute} schedule={schedule} secondaryBatchMap={secondaryBatchMap} />,
  };
 
  const activeTabInfo = TAB_GROUPS.flatMap(g => g.tabs).find(t => t.id === tab);
  const isAdmin = isAdminRole(currentUser?.role);
  const visibleGroups = visibleTabGroups({ perms, isAdmin, currentUser });
  const allowed = visibleGroups.flatMap(g => g.tabs.map(t => t.id));

  // ── Phone: app-style shell ─────────────────────────────────────────────────
  if (isPhone) {
    const bottomItems = [
      { id: "home", label: "Home" },
      { id: "entry", label: "Entry" },
      { id: "mockanalyzer", label: "Analyzer" },
      { id: "reportcard", label: "Reports" },
      { id: "__more", label: "More" },
    ].filter(i => i.id === "home" || i.id === "__more" || allowed.includes(i.id));
    // keep five slots even if a role lacks some tabs
    const fillers = ["rankings", "marks", "analytics", "schedule"].filter(id => allowed.includes(id) && !bottomItems.some(b => b.id === id));
    while (bottomItems.length < 5 && fillers.length) {
      const id = fillers.shift();
      const t = TAB_GROUPS.flatMap(g => g.tabs).find(x => x.id === id);
      bottomItems.splice(bottomItems.length - 1, 0, { id, label: t.label.split(" ")[0] });
    }
    const goBottom = (id) => setTab(id === "__more" ? "home" : id);
    return (
      <div className="exams-root xm-root">
        <CardTableEngine enabled={isPhone} />
        {tab === "home" || !allowed.includes(tab) ? (
          <ExamHomeMobile
            groups={visibleGroups}
            onSelect={setTab}
            institute={institute}
            role={currentUser?.role}
            stats={[
              { label: "Students", val: students.length },
              { label: "Batches", val: courses.length },
              { label: "Exam types", val: examTypes.length },
            ]}
          />
        ) : (
          <>
            <ExamTopBar title={activeTabInfo?.label} id={activeTabInfo?.id} subtitle={activeTabInfo?.tip} onBack={() => setTab("home")} />
            <div className="xm-body"><ResponsiveTables>{sectionMap[tab]?.()}</ResponsiveTables></div>
          </>
        )}
        <ExamBottomBar items={bottomItems} active={tab === "home" || !allowed.includes(tab) ? "home" : tab} onSelect={goBottom} />
      </div>
    );
  }

  // ── Desktop: the portal's shared premium shell (hero + pill tabs), as in Courses / Students / Fees ──
  const activeGroup = visibleGroups.find((g) => g.tabs.some((t) => t.id === tab)) || visibleGroups[0];
  const iconOf = (id) => (p) => <ExamIcon id={id} size={p?.size || 15} />;
  const groupTabs = visibleGroups.map((g) => ({ id: g.groupLabel, label: g.groupLabel, icon: iconOf(g.tabs[0].id) }));
  const subTabs = (activeGroup?.tabs || []).map((t) => ({ id: t.id, label: t.label, icon: iconOf(t.id) }));

  return (
    <div className="exams-root px-root">
      <PremiumStyles />
      <div className="px-wrap">
        <PremiumHero
          icon={<PIcon.cap size={24} />}
          eyebrow="GNSI · Examinations"
          title="Exam HUB"
          subtitle={institute.name}
          stats={[
            { label: "Students", value: students.length, sub: "on the exam roll" },
            { label: "Batches", value: courses.length, sub: "courses & batches" },
            { label: "Exam types", value: examTypes.length, sub: "configured" },
            { label: "Signed in as", value: currentUser?.role || "Admin", sub: currentUser?.name || currentUser?.username || "" },
          ]}
        />
        <PremiumTabs tabs={groupTabs} active={activeGroup?.groupLabel} onChange={(g) => { const grp = visibleGroups.find((x) => x.groupLabel === g); if (grp) setTab(grp.tabs[0].id); }} style={{ marginBottom: 8 }} />
        <PremiumTabs tabs={subTabs} active={tab} onChange={setTab} />
        <div className="px-section">
          <span className="px-eyebrow">{activeTabInfo?.label}</span>
          <span style={{ fontSize: 13, color: "#5d6b82" }}>{activeTabInfo?.tip}</span>
        </div>
        <ResponsiveTables>{sectionMap[tab]?.()}</ResponsiveTables>
      </div>
    </div>
  );

}