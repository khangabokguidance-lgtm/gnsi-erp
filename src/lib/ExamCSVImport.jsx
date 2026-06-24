import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../supabase";

/* ─── script loader ──────────────────────────────────────────────────────── */
function loadScript(src, id) {
  return new Promise(res => {
    if (document.getElementById(id)) return res();
    const s = document.createElement("script");
    s.src = src; s.id = id; s.onload = res;
    document.head.appendChild(s);
  });
}
async function ensureXLSX() {
  await loadScript("https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js", "_xlsx_import");
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
  tokens.forEach(w => { set.add(w); for (let i = 0; i < w.length - 1; i++) set.add(w.slice(i, i + 2)); });
  return set;
}
function diceCoeff(a, b) {
  const A = bigrams(a), B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0; A.forEach(v => { if (B.has(v)) inter++; });
  return (2 * inter) / (A.size + B.size);
}

const SUBJECT_ALIASES = {
  "Mathematics I":   ["math1","math i","maths i","mathematics-i","maths-i","math-i","maths 1","math 1","mathematics 1","maths1","m1"],
  "Mathematics II":  ["math2","math ii","maths ii","mathematics-ii","maths-ii","math-ii","maths 2","math 2","mathematics 2","maths2","m2"],
  "Reasoning":       ["reasoning","reas","logic","logical reasoning","reason"],
  "English Grammar & Vocabulary": ["english","eng gram","grammar","vocab","grammar vocabulary","eng","grammar & vocab","grm voc","eng grammar","english gram","english grammar","vocabulary","english grammar & vocabulary","eng gr","grm","grammar and vocab"],
  "General Knowledge & Science":  ["gk","gk science","general knowledge","gen knowledge","general science","gk & science","gks","gk&sci","g.k","science gk","gk/science"],
  "Mathematics":     ["maths","math","mathematics","mat"],
  "Mental Ability":  ["mental","mental ability","mental abi","men ability","ment","mental ablt"],
  "Meitei Mayek / English Passage": ["meitei","mayek","meitei mayek","mm","passage","english passage","meitei mayek english","meitei/english","mm/eng"],
  "Meitei Mayek":    ["meitei","mayek","meitei mayek","mm"],
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
    if (aliases.some(a => normalise(a) === h)) return { sub, score: 0.97, method: "alias" };
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
      if (headers.some(h => diceCoeff(h, sub) >= 0.55 || (SUBJECT_ALIASES[sub] || []).some(a => diceCoeff(h, a) >= 0.7))) hits++;
    }
    const ratio = subs.length ? hits / subs.length : 0;
    if (ratio > bestHit) { bestHit = ratio; best = { course: c, method: "subject-pattern", conf: ratio }; }
  }
  if (best && best.conf >= 0.3) return best;
  return null;
}

function detectFromFilename(filename, courses) {
  const base = filename.replace(/\.[^.]+$/, "").toUpperCase();
  let detectedCourse = null;
  for (const c of courses) {
    if (base.includes(c.toUpperCase())) { detectedCourse = c; break; }
  }
  let detectedDate = null;
  const isoMatch     = base.match(/(\d{4})[_\-](\d{2})[_\-](\d{2})/);
  const compactMatch = base.match(/(\d{4})(\d{2})(\d{2})/);
  const dmyMatch     = base.match(/(\d{1,2})[_\-](\d{1,2})[_\-](\d{4})/);
  const monthNames   = { JAN:"01",FEB:"02",MAR:"03",APR:"04",MAY:"05",JUN:"06",JUL:"07",AUG:"08",SEP:"09",OCT:"10",NOV:"11",DEC:"12" };
  const monthMatch   = base.match(/([A-Z]{3,9})\s*(\d{4})/);
  if (isoMatch)          detectedDate = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  else if (dmyMatch)     detectedDate = `${dmyMatch[3]}-${dmyMatch[2].padStart(2,"0")}-${dmyMatch[1].padStart(2,"0")}`;
  else if (compactMatch) detectedDate = `${compactMatch[1]}-${compactMatch[2]}-${compactMatch[3]}`;
  else if (monthMatch)   { const mon = monthNames[monthMatch[1].slice(0,3)]; if (mon) detectedDate = `${monthMatch[2]}-${mon}-01`; }
  return { detectedCourse, detectedDate };
}

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
  for (const x of pool) { const d = diceCoeff(rawName, x.name); if (d > bestScore) { bestScore = d; bestS = x; } }
  if (bestS && bestScore >= 0.45) return { student: bestS, method: "name-fuzzy", conf: bestScore };
  return null;
}

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

/* ─── Rollback helpers ───────────────────────────────────────────────────── */
const ROLLBACK_KEY = "gnsi_csv_import_rollback";

async function saveRollbackSnapshot(studentIds, examTypeId, examDate) {
  try {
    // Fetch exam_schedule records for this type/date, then find associated marks
    const { data: schedules } = await supabase
      .from("exam_schedule")
      .select("id")
      .eq("exam_type_id", examTypeId)
      .eq("exam_date", examDate);
    
    if (!schedules?.length) return;
    
    const examIds = schedules.map(s => s.id);
    const { data } = await supabase.from("exam_marks").select("*")
      .in("exam_id", examIds)
      .in("student_id", studentIds.length ? studentIds : ["__none__"]);
    
    sessionStorage.setItem(ROLLBACK_KEY, JSON.stringify({
      rows: data || [], examIds, examTypeId, examDate,
      savedAt: new Date().toISOString(), studentIds,
    }));
  } catch (_) {}
}

function loadRollbackSnapshot() {
  try { return JSON.parse(sessionStorage.getItem(ROLLBACK_KEY) || "null"); }
  catch (_) { return null; }
}

/* ─── styles ─────────────────────────────────────────────────────────────── */
const css = {
  card:  { background: "#ffffff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "14px 18px", marginBottom: 12 },
  btn:   { padding: "7px 16px", borderRadius: 8, border: "none", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 },
  input: { padding: "7px 10px", borderRadius: 8, border: "1px solid #D1D5DB", fontSize: 13, outline: "none", width: "100%", boxSizing: "border-box", color: "#111827", fontFamily: "inherit", background: "#ffffff" },
};

function Badge({ label, color, bg }) {
  return <span style={{ display: "inline-block", padding: "2px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700, color, background: bg }}>{label}</span>;
}
function ConfBar({ score }) {
  const pct = Math.round(score * 100);
  const color = pct >= 80 ? "#0F6E56" : pct >= 50 ? "#BA7517" : "#A32D2D";
  const bg    = pct >= 80 ? "#E1F5EE" : pct >= 50 ? "#FAEEDA" : "#FCEBEB";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span style={{ color, background: bg, padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700 }}>{pct}%</span>
      <span style={{ display: "inline-block", width: 60, height: 4, background: "#F3F4F6", borderRadius: 2, overflow: "hidden" }}>
        <span style={{ display: "block", width: `${pct}%`, height: "100%", background: color, borderRadius: 2 }} />
      </span>
    </span>
  );
}

/* ─── Fuzzy subject matcher for handling spacing/punctuation variations ───── */
function findBestScheduleSubject(configSubject, scheduleSubjects) {
  const normalize = (s) => String(s).toLowerCase()
    .replace(/\s*[-–—]\s*/g, ' ')  // "Mathematics -I" → "mathematics i"
    .replace(/\s+/g, ' ')
    .trim();
  
  const configNorm = normalize(configSubject);
  
  // Exact match first
  for (const sched of scheduleSubjects) {
    if (normalize(sched) === configNorm) return sched;
  }
  
  // Fuzzy match: check if normalized forms are very similar (substring)
  for (const sched of scheduleSubjects) {
    const schedNorm = normalize(sched);
    if (configNorm.includes(schedNorm) || schedNorm.includes(configNorm)) return sched;
  }
  
  return null; // No match found
}

/* ─── MAIN COMPONENT ─────────────────────────────────────────────────────── */
export default function ExamCSVImport({
  courseSubjects = {},
  students = [],
  examTypes = [],
  examDate: examDateProp = "",
  examTypeId: examTypeIdProp = "",
  onImportDone,
  isMobile = false,
}) {
  const courses = Object.keys(courseSubjects);
  const fileRef = useRef(null);

  const [localExamTypeId, setLocalExamTypeId] = useState(examTypeIdProp || examTypes[0]?.id || "");
  const [localExamDate,   setLocalExamDate]   = useState(examDateProp   || new Date().toISOString().split("T")[0]);
  useEffect(() => { if (examTypeIdProp) setLocalExamTypeId(examTypeIdProp); }, [examTypeIdProp]);
  useEffect(() => { if (examDateProp)   setLocalExamDate(examDateProp);     }, [examDateProp]);

  const [stage,         setStage]         = useState("idle");
  const [dragging,      setDragging]      = useState(false);
  const [importState,   setImportState]   = useState(null);
  const [doneLog,       setDoneLog]       = useState(null);
  const [subOverrides,  setSubOverrides]  = useState({});
  const [markOverrides, setMarkOverrides] = useState({});
  const [absentSet,     setAbsentSet]     = useState(new Set());
  const [fileQueue,     setFileQueue]     = useState([]);
  const [queueResults,  setQueueResults]  = useState([]);
  const [rollbackSnap,  setRollbackSnap]  = useState(null);
  const [rollingBack,   setRollingBack]   = useState(false);
  const [rollbackDone,  setRollbackDone]  = useState(false);
  const [rollbackError, setRollbackError] = useState("");

  useEffect(() => { setRollbackSnap(loadRollbackSnapshot()); }, []);

  const buildState = useCallback((name, rows, overrideDate, overrideCourse) => {
    if (!rows || rows.length < 2) return null;
    const headers  = rows[0].map(h => String(h).trim());
    const dataRows = rows.slice(1).filter(r => r.some(c => String(c).trim()));
    const fromFile = detectFromFilename(name, courses);
    const det      = detectCourse(headers, dataRows, courseSubjects);
    const course   = overrideCourse || fromFile.detectedCourse || det?.course || (courses[0] || "");
    const autoDate = overrideDate   || fromFile.detectedDate   || null;
    const subs     = courseSubjects[course] || [];
    const nameCol  = headers.findIndex(h => /name/i.test(h));
    const gccCol   = headers.findIndex(h => /gcc|roll/i.test(h));
    const admCol   = headers.findIndex(h => /adm(ission)?/i.test(h));
    const crsCol   = headers.findIndex(h => /^course$/i.test(h));
    const specialCols = new Set([nameCol, gccCol, admCol, crsCol].filter(i => i >= 0));
    const subjectMappings = headers
      .map((h, i) => ({ csvIdx: i, header: h }))
      .filter(({ csvIdx }) => !specialCols.has(csvIdx) && headers[csvIdx].trim())
      .map(({ csvIdx, header }) => ({ csvIdx, header, match: matchSubject(header, subs) }));
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
    return { headers, dataRows, course, det, fromFile, autoDate, subs, nameCol, gccCol, admCol, crsCol, subjectMappings, stuRows, filename: name };
  }, [courseSubjects, students, courses]);

  const processRawFile = useCallback(async (file) => {
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "xlsx" || ext === "xls") {
      await ensureXLSX();
      const buf = await file.arrayBuffer();
      const wb  = window.XLSX.read(buf, { type: "array" });
      if (wb.SheetNames.length > 1) {
        return wb.SheetNames.map(sn => ({
          name: `${file.name} [${sn}]`,
          rows: window.XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, defval: "" }),
        })).filter(s => s.rows.length >= 2);
      }
      return [{ name: file.name, rows: window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" }) }];
    }
    return [{ name: file.name, rows: parseCSV(await file.text()) }];
  }, []);

  const handleFiles = useCallback(async (files) => {
    const all = (await Promise.all(files.map(f => processRawFile(f)))).flat();
    const states = all.map(({ name, rows }) => buildState(name, rows, null, null)).filter(Boolean);
    if (!states.length) return;
    setImportState(states[0]);
    setFileQueue(states.slice(1).map(s => ({ label: s.filename, state: s })));
    setSubOverrides({}); setMarkOverrides({}); setAbsentSet(new Set());
    if (states[0].autoDate) setLocalExamDate(states[0].autoDate);
    setStage("mapping");
  }, [processRawFile, buildState]);

  function effectiveSub(mapping, mi) {
    if (subOverrides[mi] !== undefined) return subOverrides[mi] === "__skip__" ? null : subOverrides[mi];
    return mapping.match ? mapping.match.sub : null;
  }

  const performRollback = async () => {
    const snap = loadRollbackSnapshot();
    if (!snap) return;
    setRollingBack(true); setRollbackError("");
    try {
      await supabase.from("exam_marks").delete()
        .eq("exam_type_id", snap.examTypeId).eq("exam_date", snap.examDate)
        .in("student_id", snap.studentIds.length ? snap.studentIds : ["__none__"]);
      if (snap.rows.length > 0) {
        const restored = snap.rows.map(({ id: _id, ...rest }) => rest);
        for (let i = 0; i < restored.length; i += 100)
          await supabase.from("exam_marks").insert(restored.slice(i, i + 100));
      }
      sessionStorage.removeItem(ROLLBACK_KEY);
      setRollbackSnap(null); setRollbackDone(true);
      setTimeout(() => setRollbackDone(false), 3000);
    } catch (err) { setRollbackError(String(err?.message || err)); }
    setRollingBack(false);
  };

  function downloadValidationReport(stuRows, unmappedMaps, course) {
    const lines = [
      ["Type", "CSV Value", "Details", "Suggestion"],
      ...stuRows.filter(r => !r.match).map(r => [
        "Unmatched Student", r.rawName || r.rawGcc || "—",
        `GCC: ${r.rawGcc || "—"}, Name: ${r.rawName || "—"}`,
        "Check GCC number or add student in Students tab",
      ]),
      ...unmappedMaps.map(({ m }) => [
        "Unmatched Subject Column", m?.header || "—",
        `Column index: ${m?.csvIdx ?? "—"}`,
        "Manually map this column in the subject mapping table",
      ]),
    ];
    const csv = lines.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `GNSI_ImportReport_${course}_${localExamDate}.csv`;
    a.click();
  }

  async function confirmImport() {
    const { stuRows, subjectMappings, course } = importState;
    const activeMaps    = subjectMappings.map((m, mi) => ({ m, sub: effectiveSub(m, mi) })).filter(x => x.sub);
    const validStudents = stuRows.filter(r => r.match);
    const studentIds    = validStudents.map(r => r.match.student.id);

    await saveRollbackSnapshot(studentIds, localExamTypeId, localExamDate);
    setRollbackSnap(loadRollbackSnapshot());

    // Fetch exam_schedule to map subjects to exam_ids
    console.log(`[ExamCSVImport.confirmImport] Looking for exams: examTypeId="${localExamTypeId}", examDate="${localExamDate}"`);
    const { data: schedules, error: schedError } = await supabase
      .from("exam_schedule")
      .select("id, subject, exam_type_id, exam_date")
      .eq("exam_type_id", localExamTypeId)
      .eq("exam_date", localExamDate);
    
    console.log(`[ExamCSVImport.confirmImport] Query returned:`, schedules, "error:", schedError);
    
    if (schedError || !schedules?.length) {
      setImporting(false);
      const msg = `No exams found for examTypeId="${localExamTypeId}" and examDate="${localExamDate}". Create an exam schedule first, or check that the date matches exactly.`;
      console.error(msg);
      alert(msg);
      return;
    }
    
    const examIdBySubject = {};
    const scheduleSubjectsSet = new Set();
    schedules.forEach(s => { 
      examIdBySubject[s.subject] = s.id;
      scheduleSubjectsSet.add(s.subject);
    });
    const scheduleSubjects = Array.from(scheduleSubjectsSet);

    const rows = [];
    for (const { match, row } of stuRows) {
      if (!match) continue;
      const st = match.student;
      for (const { m, sub } of activeMaps) {
        const key      = `${st.id}-${sub}`;
        const override = markOverrides[key];
        const raw      = override !== undefined ? override : (absentSet.has(st.id) ? 0 : row[m.csvIdx]);
        const v        = parseFloat(raw);
        if (!isNaN(v) && raw !== "" && raw !== undefined) {
          // Try exact match first, then fuzzy match
          let examId = examIdBySubject[sub];
          if (!examId) {
            const bestMatch = findBestScheduleSubject(sub, scheduleSubjects);
            if (bestMatch) examId = examIdBySubject[bestMatch];
          }
          if (!examId) {
            alert(`Subject "${sub}" not found in exam schedule. Available: ${scheduleSubjects.join(', ')}`);
            return;
          }
          rows.push({
            student_id:   st.id,
            exam_id:      examId,
            marks_obtained: v,
            class_name:   st.class_name,
          });
        }
      }
    }

    // Check for duplicate (student_id, exam_id) pairs within the batch
    console.log(`[ExamCSVImport.confirmImport] Inserting ${rows.length} rows:`, rows);
    const seen = new Map();
    for (const r of rows) {
      const key = `${r.student_id}-${r.exam_id}`;
      if (seen.has(key)) {
        setImporting(false);
        alert(`Duplicate entry detected: Student ${r.student_id} has marks for exam ${r.exam_id} listed twice in the import. Check your CSV for duplicate student rows or subject columns.`);
        return;
      }
      seen.set(key, r);
    }

    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await supabase.from("exam_marks").upsert(rows.slice(i, i + 100), { 
        onConflict: "student_id,exam_id" 
      });
      if (error) {
        alert(`Import failed: ${error.message}`);
        console.error("Upsert error:", error, "batch:", rows.slice(i, i + 100));
        return;
      }
    }

    const log = {
      imported:     rows.length,
      skipped:      stuRows.filter(r => !r.match).length,
      course,
      filename:     importState.filename,
      studentCount: validStudents.length,
      subjectCount: activeMaps.length,
      absentCount:  absentSet.size,
      examDate:     localExamDate,
      examTypeId:   localExamTypeId,
      examTypeName: examTypes.find(e => e.id === localExamTypeId)?.name || "",
    };
    setDoneLog(log);
    setQueueResults(p => [...p, log]);
    setStage("done");
    if (typeof onImportDone === "function")
      onImportDone({}, course, localExamTypeId, localExamDate);
  }

  function downloadTemplate(course) {
    const subs = courseSubjects[course] || [];
    const sts  = students.filter(s =>
      (s.class_name || "").toUpperCase() === course ||
      (s.course     || "").toUpperCase() === course
    );
    const headers = ["GCC No", "Student Name", "Admission No", "Course", ...subs];
    const rowData = sts.map(s => [s.gcc_no, s.name, s.admission_no || "", s.course || course, ...subs.map(() => "")]);
    const csv     = [headers, ...rowData].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = "data:text/csv;charset=utf-8," + encodeURIComponent(csv);
    a.download = `GNSI_ImportTemplate_${course}_${localExamDate || "date"}.csv`;
    a.click();
  }

  function onDrop(e) {
    e.preventDefault(); setDragging(false);
    const files = Array.from(e.dataTransfer.files);
    if (files.length) handleFiles(files);
  }

  /* ════════ RENDER ════════════════════════════════════════════════════════ */

  if (stage === "idle") return (
    <div>
      <div style={{ ...css.card, background: "#F8FAFC", display: "flex", gap: 14, flexWrap: "wrap", alignItems: "flex-end" }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={localExamTypeId} onChange={e => setLocalExamTypeId(e.target.value)} style={css.input}>
            {examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
          </select>
        </div>
        <div style={{ flex: 1, minWidth: 140 }}>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Date</label>
          <input type="date" value={localExamDate} onChange={e => setLocalExamDate(e.target.value)} style={css.input} />
        </div>
        <div style={{ fontSize: 11, color: "#9CA3AF", alignSelf: "center" }}>Marks saved under these values</div>
      </div>

      <div
        onClick={() => fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `1.5px dashed ${dragging ? "#1a3c2e" : "#D1D5DB"}`,
          borderRadius: 12, padding: "2.5rem 1rem", textAlign: "center", cursor: "pointer",
          background: dragging ? "#E1F5EE22" : "#F9FAFB",
          marginBottom: 18, transition: "all .15s",
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 8 }}>📂</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#1e293b", marginBottom: 5 }}>Drop CSV or Excel here</div>
        <div style={{ fontSize: 13, color: "#6B7280" }}>.csv · .xlsx · .xls — drop multiple files or a multi-sheet Excel for batch import</div>
      </div>
      <input ref={fileRef} type="file" accept=".csv,.xlsx,.xls" multiple style={{ display: "none" }}
        onChange={e => { const f = Array.from(e.target.files); if (f.length) handleFiles(f); }} />

      <div style={css.card}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>📋 Download blank templates</div>
        <div style={{ fontSize: 12, color: "#6B7280", marginBottom: 10 }}>Filename encodes course + date for auto-detection on re-import.</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {courses.map(c => (
            <button key={c} onClick={() => downloadTemplate(c)}
              style={{ ...css.btn, background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB", fontSize: 12 }}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {rollbackSnap && (
        <div style={{ ...css.card, background: "#FFFBEB", borderColor: "#FDE68A" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#92400E", marginBottom: 6 }}>↩ Rollback available</div>
          <div style={{ fontSize: 12, color: "#92400E", marginBottom: 10 }}>
            Last import: <strong>{rollbackSnap.examDate}</strong> · {rollbackSnap.rows.length} mark rows · saved at {new Date(rollbackSnap.savedAt).toLocaleTimeString()}.
          </div>
          {rollbackError && <div style={{ fontSize: 12, color: "#DC2626", marginBottom: 8 }}>⚠ {rollbackError}</div>}
          <button onClick={performRollback} disabled={rollingBack}
            style={{ ...css.btn, background: rollbackDone ? "#E1F5EE" : "#FFFBEB", color: rollbackDone ? "#0F6E56" : "#92400E", border: "1px solid " + (rollbackDone ? "#BBF7D0" : "#FDE68A") }}>
            {rollingBack ? "⏳ Restoring…" : rollbackDone ? "✓ Rolled back" : "↩ Undo last import"}
          </button>
        </div>
      )}

      {queueResults.length > 0 && (
        <div style={{ ...css.card, borderColor: "#BBF7D0", background: "#F0FDF4" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#0F6E56", marginBottom: 8 }}>✅ Completed this session</div>
          {queueResults.map((log, i) => (
            <div key={i} style={{ fontSize: 12, color: "#374151", padding: "5px 0", borderBottom: i < queueResults.length - 1 ? "1px solid #D1FAE5" : "none" }}>
              <strong>{log.course}</strong> · {log.examDate} · {log.examTypeName} · {log.studentCount} students · {log.imported} entries
              {log.absentCount > 0 && <span style={{ color: "#BA7517", marginLeft: 8 }}>{log.absentCount} absent</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (stage === "done" && doneLog) return (
    <div>
      <div style={{ ...css.card, border: "1px solid #BBF7D0", background: "#F0FDF4" }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "#0F6E56", marginBottom: 10 }}>✅ Import complete</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(130px,1fr))", gap: 8, marginBottom: 12 }}>
          {[
            { label: "Mark entries",  val: doneLog.imported },
            { label: "Students",      val: doneLog.studentCount },
            { label: "Subjects",      val: doneLog.subjectCount },
            { label: "Skipped rows",  val: doneLog.skipped },
            { label: "Absent marked", val: doneLog.absentCount },
          ].map(x => (
            <div key={x.label} style={{ background: "white", borderRadius: 8, padding: "8px 12px" }}>
              <div style={{ fontSize: 11, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 3 }}>{x.label}</div>
              <div style={{ fontFamily: "Georgia,serif", fontSize: 22, fontWeight: 600, color: "#1a3c2e" }}>{x.val}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 12, color: "#64748b" }}>
          Course: <strong>{doneLog.course}</strong> · Exam: <strong>{doneLog.examTypeName}</strong> · Date: <strong>{doneLog.examDate}</strong>
          {doneLog.skipped > 0 && <span style={{ marginLeft: 10, color: "#BA7517" }}>⚠ {doneLog.skipped} rows unmatched.</span>}
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={() => { setStage("idle"); setMarkOverrides({}); setAbsentSet(new Set()); }}
          style={{ ...css.btn, background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB" }}>
          Import another file
        </button>
        {fileQueue.length > 0 && (
          <button onClick={() => {
            const next = fileQueue[0];
            setImportState(next.state);
            setFileQueue(q => q.slice(1));
            setSubOverrides({}); setMarkOverrides({}); setAbsentSet(new Set());
            if (next.state.autoDate) setLocalExamDate(next.state.autoDate);
            setStage("mapping");
          }} style={{ ...css.btn, background: "#1a3c2e", color: "white" }}>
            ▶ Next: {fileQueue[0].label} ({fileQueue.length} remaining)
          </button>
        )}
      </div>
    </div>
  );

  if (stage !== "mapping" || !importState) return null;
  const { course, det, fromFile, autoDate, subs, subjectMappings, stuRows, filename } = importState;
  const activeMaps    = subjectMappings.map((m, mi) => ({ m, mi, sub: effectiveSub(m, mi) })).filter(x => x.sub);
  const validStudents = stuRows.filter(r => r.match);
  const maxForSub     = {}; subs.forEach(s => { maxForSub[s] = 100; });
  const autoAbsentIds = validStudents.filter(({ match, row }) =>
    activeMaps.every(({ m }) => { const v = parseFloat(row[m.csvIdx]); return isNaN(v) || v === 0; })
  ).map(r => r.match.student.id);
  const unmappedMaps = subjectMappings.map((m, mi) => ({ m, sub: effectiveSub(m, mi) })).filter(x => !x.sub);

  return (
    <div>
      <div style={css.card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 4 }}>📂 {filename}</div>
            {(det || fromFile.detectedCourse) ? (
              <div style={{ fontSize: 12, color: "#6B7280" }}>
                Course: <strong style={{ color: "#1a3c2e" }}>{course}</strong>
                {det && <span style={{ marginLeft: 8 }}><Badge label={`${Math.round(det.conf * 100)}% confident`} color="#0F6E56" bg="#E1F5EE" /></span>}
                {fromFile.detectedCourse && <span style={{ marginLeft: 6, fontSize: 11, color: "#9CA3AF" }}>· from filename</span>}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "#BA7517" }}>⚠ Course not auto-detected — defaulting to {course}.</div>
            )}
            {autoDate && <div style={{ fontSize: 11, color: "#0F6E56", marginTop: 3 }}>📅 Date from filename: <strong>{autoDate}</strong></div>}
          </div>
          <button onClick={() => setStage("idle")}
            style={{ ...css.btn, padding: "5px 12px", background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB", fontSize: 12 }}>
            ✕ Cancel
          </button>
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12, paddingTop: 12, borderTop: "1px solid #F1F5F9" }}>
          <div style={{ flex: 1, minWidth: 140 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4, textTransform: "uppercase" }}>Exam Type</label>
            <select value={localExamTypeId} onChange={e => setLocalExamTypeId(e.target.value)} style={{ ...css.input, fontSize: 12 }}>
              {examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}
            </select>
          </div>
          <div style={{ flex: 1, minWidth: 130 }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 4, textTransform: "uppercase" }}>Exam Date</label>
            <input type="date" value={localExamDate} onChange={e => setLocalExamDate(e.target.value)} style={{ ...css.input, fontSize: 12 }} />
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <Badge label={`${activeMaps.length}/${subjectMappings.length} subjects matched`} color="#185FA5" bg="#E6F1FB" />
          <Badge label={`${validStudents.length}/${stuRows.length} students matched`} color="#0F6E56" bg="#E1F5EE" />
          {stuRows.filter(r => !r.match).length > 0 && <Badge label={`${stuRows.filter(r => !r.match).length} unmatched`} color="#A32D2D" bg="#FCEBEB" />}
          {autoAbsentIds.length > 0 && <Badge label={`${autoAbsentIds.length} possibly absent`} color="#BA7517" bg="#FAEEDA" />}
          {fileQueue.length > 0 && <Badge label={`+${fileQueue.length} queued`} color="#7c3aed" bg="#EDE9FE" />}
        </div>
      </div>

      {autoAbsentIds.length > 0 && (
        <div style={{ ...css.card, background: "#FFFBEB", borderColor: "#FDE68A" }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: "#92400E", marginBottom: 6 }}>
            ⚠ {autoAbsentIds.length} student{autoAbsentIds.length > 1 ? "s" : ""} have all-zero or blank marks
          </div>
          <div style={{ fontSize: 12, color: "#92400E", marginBottom: 8 }}>These may be absent. Mark as absent to explicitly record them.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setAbsentSet(prev => { const n = new Set(prev); autoAbsentIds.forEach(id => n.add(id)); return n; })}
              style={{ ...css.btn, background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A", fontSize: 12 }}>
              Mark all {autoAbsentIds.length} absent
            </button>
            <button onClick={() => setAbsentSet(prev => { const n = new Set(prev); autoAbsentIds.forEach(id => n.delete(id)); return n; })}
              style={{ ...css.btn, background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB", fontSize: 12 }}>
              Clear absent flags
            </button>
          </div>
        </div>
      )}

      <div style={{ ...css.card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>
          Subject column mapping <span style={{ fontWeight: 400, fontSize: 11, opacity: .75, marginLeft: 8 }}>edit before importing</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 24px 1fr 80px", gap: 8, padding: "7px 14px", background: "#F9FAFB", fontSize: 11, fontWeight: 600, color: "#6B7280" }}>
          <span>CSV column</span><span></span><span>Maps to subject</span><span>Confidence</span>
        </div>
        {subjectMappings.length === 0 && <div style={{ padding: "16px 14px", fontSize: 13, color: "#6B7280" }}>No subject columns detected.</div>}
        {subjectMappings.map((m, mi) => {
          const score = subOverrides[mi] !== undefined ? (subOverrides[mi] === "__skip__" ? 0 : 0.99) : (m.match ? m.match.score : 0);
          return (
            <div key={mi} style={{ display: "grid", gridTemplateColumns: "1fr 24px 1fr 80px", gap: 8, padding: "9px 14px", borderBottom: "1px solid #F1F5F9", alignItems: "center", fontSize: 13 }}>
              <div>
                <div style={{ fontWeight: 600 }}>{m.header}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>col {m.csvIdx + 1} · {m.match ? m.match.method : "no match"}</div>
              </div>
              <div style={{ textAlign: "center", fontSize: 16 }}>→</div>
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

      <div style={{ ...css.card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13 }}>
          Student matching <span style={{ fontWeight: 400, fontSize: 11, opacity: .75, marginLeft: 8 }}>{validStudents.length} matched · {stuRows.filter(r => !r.match).length} unmatched</span>
        </div>
        <div style={{ overflowX: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 520 }}>
            <thead>
              <tr style={{ background: "#F9FAFB" }}>
                {["CSV name", "GCC", "Matched student", "Method", "Status", "Absent"].map(h => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontWeight: 600, color: "#6B7280", fontSize: 11, borderBottom: "1px solid #E5E7EB" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stuRows.map((r, i) => {
                const isAbsent = r.match && absentSet.has(r.match.student.id);
                return (
                  <tr key={i} style={{ borderBottom: "1px solid #F1F5F9", background: isAbsent ? "#FFF7ED" : (i % 2 ? "#F9FAFB" : "white") }}>
                    <td style={{ padding: "7px 10px", fontWeight: 500 }}>{r.rawName || "—"}</td>
                    <td style={{ padding: "7px 10px", color: "#6B7280" }}>{r.rawGcc || "—"}</td>
                    <td style={{ padding: "7px 10px", fontWeight: r.match ? 600 : 400, color: r.match ? "#1e293b" : "#A32D2D" }}>
                      {r.match ? r.match.student.name : "Not found"}
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      {r.match && <Badge label={r.match.method} color={r.match.conf >= 0.9 ? "#0F6E56" : "#BA7517"} bg={r.match.conf >= 0.9 ? "#E1F5EE" : "#FAEEDA"} />}
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      <Badge
                        label={r.match ? (isAbsent ? "🔴 Absent" : "✓ matched") : "✗ skip"}
                        color={isAbsent ? "#BA7517" : r.match ? "#0F6E56" : "#A32D2D"}
                        bg={isAbsent ? "#FAEEDA" : r.match ? "#E1F5EE" : "#FCEBEB"}
                      />
                    </td>
                    <td style={{ padding: "7px 10px" }}>
                      {r.match && (
                        <button
                          onClick={() => setAbsentSet(prev => { const n = new Set(prev); n.has(r.match.student.id) ? n.delete(r.match.student.id) : n.add(r.match.student.id); return n; })}
                          style={{ ...css.btn, padding: "2px 8px", fontSize: 11, background: isAbsent ? "#FED7AA" : "#F3F4F6", color: isAbsent ? "#92400E" : "#374151", border: `1px solid ${isAbsent ? "#FDBA74" : "#E5E7EB"}` }}>
                          {isAbsent ? "✓ Absent" : "Mark absent"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ ...css.card, padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "10px 16px", background: "#1a3c2e", color: "white", fontWeight: 700, fontSize: 13, display: "flex", justifyContent: "space-between" }}>
          <span>Preview — {validStudents.length} students · {activeMaps.length} subjects</span>
          <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.75 }}>click any mark to edit</span>
        </div>
        <div style={{ overflowX: "auto", maxHeight: 340, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 400 }}>
            <thead style={{ position: "sticky", top: 0 }}>
              <tr style={{ background: "#1a3c2e" }}>
                <th style={{ padding: "8px 12px", textAlign: "left", color: "white", fontWeight: 700, minWidth: 120 }}>Student</th>
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
                const isAbsent = absentSet.has(st.id);
                const subVals = activeMaps.map(({ m, sub }) => {
                  const key = `${st.id}-${sub}`;
                  const ov  = markOverrides[key];
                  const raw = ov !== undefined ? ov : row[m.csvIdx];
                  const v   = isAbsent ? 0 : parseFloat(raw);
                  return { sub, v: isNaN(v) ? null : v, edited: ov !== undefined, key };
                });
                const total    = subVals.reduce((s, x) => s + (x.v || 0), 0);
                const maxTotal = activeMaps.length * 100;
                const pct      = maxTotal ? Math.round((total / maxTotal) * 100) : 0;
                const gc       = pct >= 80 ? "#0F6E56" : pct >= 60 ? "#185FA5" : pct >= 40 ? "#BA7517" : "#A32D2D";
                return (
                  <tr key={st.id} style={{ background: isAbsent ? "#FFF7ED" : (i % 2 ? "#F9FAFB" : "white"), borderBottom: "1px solid #F1F5F9" }}>
                    <td style={{ padding: "7px 12px", fontWeight: 600, whiteSpace: "nowrap" }}>
                      {st.name}
                      {isAbsent && <span style={{ marginLeft: 6, fontSize: 10, color: "#BA7517", fontWeight: 700 }}>ABSENT</span>}
                    </td>
                    {subVals.map(({ sub, v, edited, key }) => (
                      <td key={sub} style={{ padding: "4px 6px", textAlign: "center" }}>
                        {isAbsent ? (
                          <span style={{ color: "#BA7517", fontWeight: 700 }}>0</span>
                        ) : (
                          <input type="number" value={v !== null ? v : ""} placeholder="—"
                            onChange={e => {
                              const val = e.target.value === "" ? undefined : parseFloat(e.target.value);
                              setMarkOverrides(prev => { const n = { ...prev }; val === undefined ? delete n[key] : (n[key] = val); return n; });
                            }}
                            style={{ width: 52, padding: "3px 4px", textAlign: "center", fontSize: 12, border: `1px solid ${edited ? "#6366F1" : "#D1D5DB"}`, borderRadius: 5, background: edited ? "#EEF2FF" : "transparent", color: edited ? "#4338CA" : "#111827", fontWeight: edited ? 700 : 400 }}
                          />
                        )}
                      </td>
                    ))}
                    <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 700 }}>{total || "—"}</td>
                    <td style={{ padding: "7px 10px", textAlign: "center", fontWeight: 700, color: gc }}>{pct ? pct + "%" : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <button onClick={confirmImport} disabled={validStudents.length === 0 || activeMaps.length === 0}
          style={{ ...css.btn, background: validStudents.length === 0 ? "#9CA3AF" : "#1a3c2e", color: "white", padding: "9px 22px", fontSize: 14 }}>
          ✅ Confirm import ({validStudents.length} students)
        </button>
        <button onClick={() => setStage("idle")}
          style={{ ...css.btn, background: "#F3F4F6", color: "#374151", border: "1px solid #E5E7EB" }}>
          Cancel
        </button>
        {(stuRows.filter(r => !r.match).length > 0 || unmappedMaps.length > 0) && (
          <button onClick={() => downloadValidationReport(stuRows, unmappedMaps, course)}
            style={{ ...css.btn, background: "#FFFBEB", color: "#92400E", border: "1px solid #FDE68A", fontSize: 12 }}>
            📥 Mismatch report ({stuRows.filter(r => !r.match).length} unmatched)
          </button>
        )}
        {Object.keys(markOverrides).length > 0 && (
          <button onClick={() => setMarkOverrides({})}
            style={{ ...css.btn, background: "#EEF2FF", color: "#4338CA", border: "1px solid #C7D2FE", fontSize: 12 }}>
            ↩ Clear {Object.keys(markOverrides).length} edit{Object.keys(markOverrides).length > 1 ? "s" : ""}
          </button>
        )}
        {validStudents.length === 0 && (
          <span style={{ fontSize: 12, color: "#A32D2D" }}>No students matched. Check GCC numbers or download a template.</span>
        )}
      </div>
    </div>
  );
}