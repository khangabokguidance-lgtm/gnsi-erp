/**
 * ExamCSVImport.jsx
 * Smart CSV / Excel import for GNSI Exam System
 *
 * Props:
 *   courseSubjects  – { [course]: string[] }          from Exams.jsx state
 *   students        – Student[]                        from Exams.jsx state
 *   examTypes       – ExamType[]                       from Exams.jsx state
 *   examDate        – string  (YYYY-MM-DD)             controlled by parent
 *   examTypeId      – string  exam_type_id             controlled by parent
 *   onImportDone    – (importedMarks: MarkMap, course: string) => void
 *   isMobile        – boolean
 *
 * MarkMap shape: { [`${studentId}-${subject}`]: number }
 *
 * Wire-up in Exams.jsx:
 *   1. Add <ExamCSVImport> tab in TAB_GROUPS (id:"csvimport")
 *   2. In sectionMap add: csvimport: <ExamCSVImport ... />
 *   3. In MarkEntry add an "Import" button that sets tab to "csvimport"
 *      or keep ExamCSVImport as a panel inside MarkEntry.
 *
 * The component is self-contained — no extra Supabase tables needed.
 * On confirmImport it calls onImportDone with the resolved mark map so
 * Exams.jsx can upsert to exam_marks via its existing handleSave logic.
 */

import React, { useState, useRef, useCallback } from "react";

/* ─── helpers shared with Exams.jsx ──────────────────────────────────────── */
function loadScript(src, id) {
  return new Promise(res => {
    if (document.getElementById(id)) return res();
    const s = document.createElement("script");
    s.src = src; s.id = id; s.onload = res;
    document.head.appendChild(s);
  });
}
async function ensureXLSX() {
  await loadScript(
    "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
    "_xlsx_import"
  );
}

/* ─── fuzzy engine ───────────────────────────────────────────────────────── */
function normalise(s) {
  return String(s).toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(and|&|amp|the|of|in|for|by|to)\b/g, " ")
    .replace(/\s+/g, " ").trim();
}

function bigrams(str) {
  const tokens = normalise(str).split(" ").filter(Boolean);
  const set = new Set();
  tokens.forEach(w => {
    set.add(w);
    for (let i = 0; i < w.length - 1; i++) set.add(w.slice(i, i + 2));
  });
  return set;
}

function diceCoeff(a, b) {
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; A.forEach(v => { if (B.has(v)) inter++; });
  return (2 * inter) / (A.size + B.size);
}

/* subject alias dictionary — covers common abbreviations teachers use */
const SUBJECT_ALIASES = {
  "Mathematics I":   ["math1","math i","maths i","mathematics-i","maths-i","math-i","maths 1","math 1","mathematics 1","maths1","m1"],
  "Mathematics II":  ["math2","math ii","maths ii","mathematics-ii","maths-ii","math-ii","maths 2","math 2","mathematics 2","maths2","m2"],
  "Reasoning":       ["reasoning","reas","logic","logical reasoning","reason"],
  "English Grammar & Vocabulary": [
    "english","eng gram","grammar","vocab","grammar vocabulary","eng",
    "grammar & vocab","grm voc","eng grammar","english gram","english grammar",
    "vocabulary","english grammar & vocabulary","eng gr","grm","grammar and vocab",
    "eng grammar & vocab","english grm"
  ],
  "General Knowledge & Science": [
    "gk","gk science","general knowledge","gen knowledge","general science",
    "gk & science","gks","gk&sci","g.k","science gk","gk/science"
  ],
  "Mathematics":     ["maths","math","mathematics","mat","maths"],
  "Mental Ability":  ["mental","mental ability","mental abi","men ability","ment","mental ablt"],
  "Meitei Mayek / English Passage": [
    "meitei","mayek","meitei mayek","mm","passage","english passage",
    "meitei mayek english","meitei/english","mm/eng","meitei/eng passage"
  ],
  "Meitei Mayek":    ["meitei","mayek","meitei mayek","mm","meitei mayek"],
  "Science":         ["science","sci","sciences"],
  "Mental":          ["mental","men","mental ability","mental ablt"],
  "Grammar":         ["grammar","gram","grm","english grammar","grammar only"],
  "Grammar & Vocabulary": ["grammar & vocabulary","gram & vocab","grm voc","grammar vocabulary"],
};

function matchSubject(csvHeader, subjectList) {
  const h = normalise(csvHeader);
  for (const sub of subjectList) {
    if (normalise(sub) === h) return { sub, score: 1.0, method: "exact" };
    const aliases = SUBJECT_ALIASES[sub] || [];
    if (aliases.some(a => normalise(a) === h))
      return { sub, score: 0.97, method: "alias" };
  }
  let best = null, bestScore = 0;
  for (const sub of subjectList) {
    if (normalise(sub).includes(h) || h.includes(normalise(sub).split(" ")[0])) {
      const sc = 0.78;
      if (sc > bestScore) { bestScore = sc; best = { sub, score: sc, method: "substring" }; }
    }
    const dice = diceCoeff(csvHeader, sub);
    if (dice > bestScore) { bestScore = dice; best = { sub, score: dice, method: "fuzzy" }; }
    for (const alias of (SUBJECT_ALIASES[sub] || [])) {
      const ad = diceCoeff(csvHeader, alias);
      if (ad > bestScore) { bestScore = ad; best = { sub, score: ad, method: "alias-fuzzy" }; }
    }
  }
  return best && best.score >= 0.3 ? best : null;
}

/**
 * Detect which course a CSV belongs to.
 * Strategy (in order):
 *  1. Explicit "course" column in data rows
 *  2. Course name appears in any header
 *  3. Score each course by fraction of its subjects that appear in headers
 */
function detectCourse(headers, dataRows, courseSubjects) {
  const courses = Object.keys(courseSubjects);
  const courseCol = headers.findIndex(h => /^course$/i.test(h.trim()));
  if (courseCol > -1) {
    for (const row of dataRows.slice(0, 8)) {
      const v = String(row[courseCol] || "").trim().toUpperCase();
      if (courses.includes(v)) return { course: v, method: "course-column", conf: 1.0 };
      const found = courses.find(c => v.includes(c) || c.includes(v));
      if (found) return { course: found, method: "course-column-partial", conf: 0.92 };
    }
  }
  const combined = headers.join(" ").toUpperCase();
  for (const c of courses) {
    if (combined.includes(c)) return { course: c, method: "header-name", conf: 1.0 };
  }
  let best = null, bestHit = 0;
  for (const c of courses) {
    const subs = courseSubjects[c] || [];
    let hits = 0;
    for (const sub of subs) {
      if (headers.some(h => diceCoeff(h, sub) >= 0.55 ||
        (SUBJECT_ALIASES[sub] || []).some(a => diceCoeff(h, a) >= 0.7))) hits++;
    }
    const ratio = subs.length ? hits / subs.length : 0;
    if (ratio > bestHit) { bestHit = ratio; best = { course: c, method: "subject-pattern", conf: ratio }; }
  }
  if (best && best.conf >= 0.3) return best;
  return null;
}

/**
 * Match a CSV student row to a GNSI student record.
 * Priority: GCC exact → admission_no → exact name → prefix name → fuzzy name
 */
function matchStudent(rawName, rawGcc, rawAdm, pool) {
  const gcc = parseInt(rawGcc);
  if (!isNaN(gcc) && gcc > 0) {
    const s = pool.find(x => Number(x.gcc_no) === gcc);
    if (s) return { student: s, method: "GCC", conf: 1.0 };
  }
  if (rawAdm && rawAdm.trim()) {
    const s = pool.find(x => String(x.admission_no || "").trim() === rawAdm.trim());
    if (s) return { student: s, method: "adm-no", conf: 1.0 };
  }
  const nm = normalise(rawName);
  let s = pool.find(x => normalise(x.name) === nm);
  if (s) return { student: s, method: "name-exact", conf: 1.0 };
  s = pool.find(x => normalise(x.name).startsWith(nm.slice(0, 9)));
  if (s) return { student: s, method: "name-prefix", conf: 0.82 };
  let bestS = null, bestScore = 0;
  for (const x of pool) {
    const d = diceCoeff(rawName, x.name);
    if (d > bestScore) { bestScore = d; bestS = x; }
  }
  if (bestS && bestScore >= 0.45) return { student: bestS, method: "name-fuzzy", conf: bestScore };
  return null;
}

/* ─── CSV parser (handles quoted fields) ────────────────────────────────── */
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim().split("\n");
  return lines.map(line => {
    const row = []; let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') { inQ = !inQ; }
      else if (ch === "," && !inQ) { row.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    row.push(cur.trim()); return row;
  }).filter(r => r.some(c => c));
}

/* ─── styles ─────────────────────────────────────────────────────────────── */
const css = {
  card:  { background: "var(--color-background-primary)", border: "0.5px solid var(--color-border-tertiary)", borderRadius: 12, padding: "14px 18px", marginBottom: 12 },
  btn:   { padding: "7px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 },
  input: { padding: "7px 10px", borderRadius: 8, border: "0.5px solid var(--color-border-secondary)", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box", color: "var(--color-text-primary)", fontFamily: "inherit", background: "var(--color-background-primary)" },
};

function Badge({ label, color, bg }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, color, background: bg }}>{label}</span>
  );
}

function ConfBar({ score }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "#0F6E56" : pct >= 50 ? "#BA7517" : "#A32D2D";
  const bg    = pct >= 80 ? "#E1F5EE" : pct >= 50 ? "#FAEEDA" : "#FCEBEB";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ color, background: bg, padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{pct}%</span>
      <span style={{ display: "inline-block", width: 60, height: 4, background: "var(--color-background-secondary)", borderRadius: 2, overflow: "hidden" }}>
        <span style={{ display: "block", width: `${pct}%`, height: "100%", background: color, borderRadius: 2 }} />
      </span>
    </span>
  );
}

/* ─── MAIN COMPONENT ─────────────────────────────────────────────────────── */
export default function ExamCSVImport({
  courseSubjects = {},
  students = [],
  examTypes = [],
  examDate = "",
  examTypeId = "",
  onImportDone,
  isMobile = false,
}) {
  const courses = Object.keys(courseSubjects);
  const fileRef = useRef(null);

  /* stage: "idle" | "mapping" | "done" */
  const [stage, setStage] = useState("idle");
  const [dragging, setDragging] = useState(false);
  const [importState, setImportState] = useState(null);
  const [doneLog, setDoneLog] = useState(null);

  /* per-subject override selections: { mappingIndex: subjectName | "__skip__" } */
  const [subOverrides, setSubOverrides] = useState({});

  /* ── file intake ── */
  const handleFile = useCallback(async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    let rows = [];
    if (ext === "csv") {
      rows = parseCSV(await file.text());
    } else {
      await ensureXLSX();
      const buf = await file.arrayBuffer();
      const wb = window.XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = window.XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    }
    if (rows.length < 2) return;

    const headers  = rows[0].map(h => String(h).trim());
    const dataRows = rows.slice(1).filter(r => r.some(c => String(c).trim()));

    /* detect course */
    const det = detectCourse(headers, dataRows, courseSubjects);
    const course = det ? det.course : (courses[0] || "");
    const subs   = courseSubjects[course] || [];

    /* find special columns */
    const nameCol = headers.findIndex(h => /name/i.test(h));
    const gccCol  = headers.findIndex(h => /gcc|roll/i.test(h));
    const admCol  = headers.findIndex(h => /adm(ission)?/i.test(h));
    const crsCol  = headers.findIndex(h => /^course$/i.test(h));

    /* subject mappings */
    const specialCols = new Set([nameCol, gccCol, admCol, crsCol].filter(i => i >= 0));
    const subjectMappings = headers
      .map((h, i) => ({ csvIdx: i, header: h }))
      .filter(({ csvIdx }) => !specialCols.has(csvIdx) && headers[csvIdx].trim())
      .map(({ csvIdx, header }) => ({
        csvIdx,
        header,
        match: matchSubject(header, subs),
      }));

    /* student matching — use course-filtered pool first, fallback all */
    const pool = students.filter(s =>
      (s.class_name || "").toUpperCase() === course ||
      (s.course     || "").toUpperCase() === course
    );
    const matchPool = pool.length ? pool : students;

    const stuRows = dataRows.map(row => {
      const rawName = nameCol >= 0 ? String(row[nameCol] || "").trim() : "";
      const rawGcc  = gccCol  >= 0 ? String(row[gccCol]  || "").trim() : "";
      const rawAdm  = admCol  >= 0 ? String(row[admCol]  || "").trim() : "";
      return { rawName, rawGcc, rawAdm, row, match: matchStudent(rawName, rawGcc, rawAdm, matchPool) };
    }).filter(r => r.rawName || r.rawGcc);

    setImportState({ headers, dataRows, course, det, subs, nameCol, gccCol, admCol, crsCol, subjectMappings, stuRows, filename: file.name });
    setSubOverrides({});
    setStage("mapping");
  }, [courseSubjects, students, courses]);

  /* ── effective subject for a mapping row ── */
  function effectiveSub(mapping, mi) {
    if (subOverrides[mi] !== undefined) {
      return subOverrides[mi] === "__skip__" ? null : subOverrides[mi];
    }
    return mapping.match ? mapping.match.sub : null;
  }

  /* ── confirm import ── */
  function confirmImport() {
    const { stuRows, subjectMappings, course, subs, filename } = importState;
    const activeMaps = subjectMappings
      .map((m, mi) => ({ m, sub: effectiveSub(m, mi) }))
      .filter(x => x.sub);
    const maxMap = {};
    (courseSubjects[course] || []).forEach((s, _i) => {
      /* pull max from COURSE_MAX_MARKS if available, else 100 */
      maxMap[s] = 100; /* component doesn't know COURSE_MAX_MARKS, parent handles clamping */
    });

    let imported = 0, skipped = 0, clamped = 0;
    const resultMarks = {};

    for (const r of stuRows) {
      if (!r.match) { skipped++; continue; }
      const st = r.match.student;
      for (const { m, sub } of activeMaps) {
        const raw = r.row[m.csvIdx];
        const v   = parseFloat(raw);
        if (!isNaN(v) && raw !== "" && raw !== undefined) {
          resultMarks[`${st.id}-${sub}`] = v;
          imported++;
        }
      }
    }

    const log = {
      imported, skipped, clamped,
      course,
      studentCount: stuRows.filter(r => r.match).length,
      subjectCount: activeMaps.length,
      filename,
      examDate,
      examTypeId,
    };
    setDoneLog(log);
    setStage("done");
    if (typeof onImportDone === "function") {
      onImportDone(resultMarks, course);
    }
  }

  /* ── template download ── */
  function downloadTemplate(course) {
    const subs = courseSubjects[course] || [];
    const sts  = students.filter(s =>
      (s.class_name || "").toUpperCase() === course ||
      (s.course     || "").toUpperCase() === course
    );
    const headers = ["GCC No", "Student Name", "Admission No", "Course", ...subs];
    const rows    = sts.map(s => [s.gcc_no, s.name, s.admission_no || "", s.course || course, ...subs.map(() => "")]);
    const csv     = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `GNSI_ImportTemplate_${course}_${examDate || "date"}.csv`;
    a.click();
  }

  /* ── drag/drop ── */
  function onDrop(e) {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0]; if (f) handleFile(f);
  }

  /* ════════════════════════════════════════════════════════════════════════ */
  /* RENDER                                                                   */
  /* ════════════════════════════════════════════════════════════════════════ */

  /* ── IDLE ── */
  if (stage === "idle") return (
    <div>
      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `1.5px dashed ${dragging ? "#1a3c2e" : "var(--color-border-secondary)"}`,
          borderRadius: 12, padding: "2.5rem 1rem", textAlign: "center", cursor: "pointer",
          background: dragging ? "#E1F5EE22" : "var(--color-background-secondary)",
          marginBottom: 18, transition: "all .15s",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 8, color: "var(--color-text-secondary)" }}>📂</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 5 }}>
          Drop CSV or Excel file here
        </div>
        <div style={{ fontSize: 13, color: "var(--color-text-secondary)" }}>
          Accepts .csv, .xlsx, .xls — or click to browse
        </div>
      </div>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" style={{ display: "none" }}
        onChange={e => handleFile(e.target.files[0])} />

      {/* Template downloads */}
      <div style={css.card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", marginBottom: 10 }}>
          📋 Download blank templates
        </div>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", marginBottom: 10 }}>
          Each template includes your enrolled students and the correct subject columns for that course.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {courses.map(c => (
            <button key={c} onClick={() => downloadTemplate(c)}
              style={{ ...css.btn, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", border: "0.5px solid var(--color-border-secondary)", fontSize: 12 }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* Format tip */}
      <div style={{ ...css.card, background: "var(--color-background-secondary)", borderColor: "transparent" }}>
        <div style={{ fontSize: 12, color: "var(--color-text-secondary)", lineHeight: 1.6 }}>
          <strong style={{ color: "var(--color-text-primary)" }}>Smart matching handles:</strong><br />
          Abbreviated subject names (maths, gk, eng gram, mm, mental…) · GCC number or name lookup ·
          Any column order · Missing columns · Partial course names · OMR export sheets from third-party tools
        </div>
      </div>
    </div>
  );

  /* ── DONE ── */
  if (stage === "done" && doneLog) return (
    <div>
      <div style={{ ...css.card, border: "0.5px solid #BBF7D0", background: "#F0FDF4" }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#0F6E56", marginBottom: 10 }}>✅ Import complete</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 8, marginBottom: 12 }}>
          {[
            { label: "Mark entries", val: doneLog.imported },
            { label: "Students",     val: doneLog.studentCount },
            { label: "Subjects",     val: doneLog.subjectCount },
            { label: "Skipped rows", val: doneLog.skipped },
          ].map(x => (
            <div key={x.label} style={{ background: "white", borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ fontSize: 11, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>{x.label}</div>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 600, color: "#1a3c2e" }}>{x.val}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Course: <strong>{doneLog.course}</strong> · File: {doneLog.filename}
          {doneLog.skipped > 0 && <span style={{ marginLeft: 10, color: "#BA7517" }}>⚠ {doneLog.skipped} rows could not be matched to a student — check GCC numbers.</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={() => setStage("idle")}
          style={{ ...css.btn, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", border: "0.5px solid var(--color-border-secondary)" }}>
          Import another file
        </button>
      </div>
    </div>
  );

  /* ── MAPPING ── */
  if (stage !== "mapping" || !importState) return null;
  const { course, det, subs, subjectMappings, stuRows, filename } = importState;
  const activeMaps = subjectMappings.map((m, mi) => ({ m, mi, sub: effectiveSub(m, mi) })).filter(x => x.sub);
  const validStudents = stuRows.filter(r => r.match);
  const maxForSub = {}; subs.forEach(s => { maxForSub[s] = 100; }); /* parent will clamp */

  return (
    <div>
      {/* Detection header */}
      <div style={css.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--color-text-primary)", marginBottom: 4 }}>
              📂 {filename}
            </div>
            {det ? (
              <div style={{ fontSize: 12, color: "var(--color-text-secondary)" }}>
                Course detected: <strong style={{ color: "#1a3c2e" }}>{det.course}</strong>
                <span style={{ marginLeft: 8 }}><Badge label={`${Math.round(det.conf * 100)}% confident`} color="#0F6E56" bg="#E1F5EE" /></span>
                <span style={{ marginLeft: 6, fontSize: 11, color: "#9CA3AF" }}>via {det.method}</span>
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#BA7517" }}>⚠ Course not auto-detected — defaulting to {course}. Edit mappings below.</div>
            )}
          </div>
          <button onClick={() => setStage("idle")}
            style={{ ...css.btn, padding: "5px 12px", background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", border: "0.5px solid var(--color-border-secondary)", fontSize: 12 }}>
            ✕ Cancel
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <Badge label={`${subjectMappings.filter(m => effectiveSub(m, subjectMappings.indexOf(m))).length}/${subjectMappings.length} subjects matched`} color="#185FA5" bg="#E6F1FB" />
          <Badge label={`${validStudents.length}/${stuRows.length} students matched`} color="#0F6E56" bg="#E1F5EE" />
          {stuRows.filter(r => !r.match).length > 0 &&
            <Badge label={`${stuRows.filter(r => !r.match).length} unmatched`} color="#A32D2D" bg="#FCEBEB" />}
        </div>
      </div>

      {/* Subject mapping table */}
      <div style={{ ...css.card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>
          Subject column mapping
          <span style={{ fontWeight: 400, fontSize: 11, opacity: .75, marginLeft: 8 }}>edit any mapping before importing</span>
        </div>
        {/* header row */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 24px 1fr 80px", gap: 8, padding: "7px 14px", background: "var(--color-background-secondary)", fontSize: 11, fontWeight: 600, color: "var(--color-text-secondary)" }}>
          <span>CSV column</span><span></span><span>Maps to subject</span><span>Confidence</span>
        </div>
        {subjectMappings.length === 0 && (
          <div style={{ padding: "16px 14px", fontSize: 13, color: "var(--color-text-secondary)" }}>No subject columns detected.</div>
        )}
        {subjectMappings.map((m, mi) => {
          const effSub = effectiveSub(m, mi);
          const score  = subOverrides[mi] !== undefined
            ? (subOverrides[mi] === "__skip__" ? 0 : 0.99)
            : (m.match ? m.match.score : 0);
          return (
            <div key={mi} style={{ display: "grid", gridTemplateColumns: "1fr 24px 1fr 80px", gap: 8, padding: "9px 14px", borderBottom: "0.5px solid var(--color-border-tertiary)", alignItems: "center", fontSize: 13 }}>
              <div>
                <div style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>{m.header}</div>
                <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>col {m.csvIdx + 1} · {m.match ? m.match.method : "no match"}</div>
              </div>
              <div style={{ textAlign: "center", color: "var(--color-text-secondary)", fontSize: 16 }}>→</div>
              <select
                value={subOverrides[mi] !== undefined ? subOverrides[mi] : (m.match ? m.match.sub : "__skip__")}
                onChange={e => setSubOverrides(p => ({ ...p, [mi]: e.target.value }))}
                style={{ ...css.input, fontSize: 12, padding: "5px 8px" }}
              >
                <option value="__skip__">— skip this column —</option>
                {subs.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div><ConfBar score={score} /></div>
            </div>
          );
        })}
      </div>

      {/* Student match table */}
      <div style={{ ...css.card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>
          Student matching
          <span style={{ fontWeight: 400, fontSize: 11, opacity: .75, marginLeft: 8 }}>
            {validStudents.length} matched · {stuRows.filter(r => !r.match).length} unmatched
          </span>
        </div>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 480 }}>
            <thead>
              <tr style={{ background: "var(--color-background-secondary)" }}>
                {["CSV name", "GCC in file", "Matched student", "Method", "Status"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: "var(--color-text-secondary)", fontSize: 11, borderBottom: "0.5px solid var(--color-border-tertiary)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stuRows.map((r, i) => (
                <tr key={i} style={{ borderBottom: "0.5px solid var(--color-border-tertiary)", background: i % 2 ? "var(--color-background-secondary)" : "var(--color-background-primary)" }}>
                  <td style={{ padding: "7px 10px", fontWeight: 500, color: "var(--color-text-primary)" }}>{r.rawName || "—"}</td>
                  <td style={{ padding: "7px 10px", color: "var(--color-text-secondary)" }}>{r.rawGcc || "—"}</td>
                  <td style={{ padding: "7px 10px", fontWeight: r.match ? 600 : 400, color: r.match ? "var(--color-text-primary)" : "#A32D2D" }}>
                    {r.match ? r.match.student.name : "Not found"}
                  </td>
                  <td style={{ padding: "7px 10px" }}>
                    {r.match && <Badge label={r.match.method} color={r.match.conf >= 0.9 ? "#0F6E56" : "#BA7517"} bg={r.match.conf >= 0.9 ? "#E1F5EE" : "#FAEEDA"} />}
                  </td>
                  <td style={{ padding: "7px 10px" }}>
                    <Badge label={r.match ? "✓ matched" : "✗ skip"} color={r.match ? "#0F6E56" : "#A32D2D"} bg={r.match ? "#E1F5EE" : "#FCEBEB"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview */}
      <div style={{ ...css.card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>
          Import preview — {validStudents.length} students · {activeMaps.length} subjects
        </div>
        <div style={{ overflowX: "auto", maxHeight: 300, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 400 }}>
            <thead style={{ position: "sticky", top: 0 }}>
              <tr style={{ background: "#1a3c2e" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", color: "white", fontWeight: 700 }}>Student</th>
                {activeMaps.map(({ sub }) => (
                  <th key={sub} style={{ padding: "8px 8px", textAlign: "center", color: "white", fontWeight: 700, fontSize: 11, whiteSpace: "nowrap" }}>{sub}</th>
                ))}
                <th style={{ padding: "8px 10px", textAlign: "center", color: "white", fontWeight: 700 }}>Total</th>
                <th style={{ padding: "8px 10px", textAlign: "center", color: "white", fontWeight: 700 }}>%</th>
              </tr>
            </thead>
            <tbody>
              {validStudents.map(({ match, row }, i) => {
                const st = match.student;
                const subVals = activeMaps.map(({ m, sub }) => {
                  const raw = row[m.csvIdx]; const v = parseFloat(raw);
                  return { sub, v: isNaN(v) ? null : v };
                });
                const total = subVals.reduce((s, x) => s + (x.v || 0), 0);
                const maxTotal = activeMaps.reduce((s, { sub }) => s + (maxForSub[sub] || 100), 0);
                const pct = maxTotal ? Math.round((total / maxTotal) * 100) : 0;
                const gradeColor = pct >= 80 ? "#0F6E56" : pct >= 60 ? "#185FA5" : pct >= 40 ? "#BA7517" : "#A32D2D";
                return (
                  <tr key={st.id} style={{ background: i % 2 ? "var(--color-background-secondary)" : "var(--color-background-primary)", borderBottom: "0.5px solid var(--color-border-tertiary)" }}>
                    <td style={{ padding: "7px 12px", fontWeight: 600, color: "var(--color-text-primary)", whiteSpace: "nowrap" }}>{st.name}</td>
                    {subVals.map(({ sub, v }) => (
                      <td key={sub} style={{ padding: "7px 8px", textAlign: "center", color: v !== null ? "var(--color-text-primary)" : "var(--color-text-secondary)", fontWeight: v !== null ? 600 : 400 }}>
                        {v !== null ? v : "—"}
                      </td>
                    ))}
                    <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 700, color: "var(--color-text-primary)" }}>{total || "—"}</td>
                    <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 700, color: gradeColor }}>{pct ? pct + "%" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action bar */}
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={confirmImport} disabled={validStudents.length === 0 || activeMaps.length === 0}
          style={{ ...css.btn, background: validStudents.length === 0 ? "#9CA3AF" : "#1a3c2e", color: "white", padding: "9px 22px", fontSize: 14 }}>
          ✅ Confirm import ({validStudents.length} students)
        </button>
        <button onClick={() => setStage("idle")}
          style={{ ...css.btn, background: "var(--color-background-secondary)", color: "var(--color-text-secondary)", border: "0.5px solid var(--color-border-secondary)" }}>
          Cancel
        </button>
        {validStudents.length === 0 && (
          <span style={{ fontSize: 12, color: "#A32D2D" }}>No students could be matched. Check GCC numbers or download a template.</span>
        )}
      </div>
    </div>
  );
}
