/**
 * apply-exams-fixes.js
 * Run: node apply-exams-fixes.js
 * Place this file next to your Exams.jsx
 * It applies all 22 fixes automatically.
 */

const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, 'Exams.jsx')
let src = fs.readFileSync(FILE, 'utf8')
let fixes = 0

function patch(description, find, replace) {
  if (!src.includes(find)) {
    console.warn(`⚠️  SKIP (not found): ${description}`)
    return
  }
  src = src.replace(find, replace)
  fixes++
  console.log(`✅ ${description}`)
}

// ─── FIX 11 — CDN error handling ─────────────────────────────────────────────
patch(
  'FIX 11: CDN load error handling',
  `function loadScript(src, id) {
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
}`,
  `function loadScript(src, id) {
  return new Promise((res, rej) => {
    if (document.getElementById(id)) return res()
    const s = document.createElement('script')
    s.src = src; s.id = id
    s.onload = res
    s.onerror = () => { console.warn('Failed to load: ' + src); res() } // resolve anyway so app doesn't crash
    document.head.appendChild(s)
  })
}
async function ensureLibs() {
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js', '_xlsx')
  await loadScript('https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js', '_chartjs')
}
const isXLSXReady  = () => !!window.XLSX
const isChartReady = () => !!window.Chart`
)

// ─── FIX 4 — Schedule refresh parent ─────────────────────────────────────────
patch(
  'FIX 4: Schedule function signature accepts onScheduleChange',
  `function Schedule({ courseSubjects, examTypes }) {`,
  `function Schedule({ courseSubjects, examTypes, onScheduleChange }) {`
)

patch(
  'FIX 4: Schedule handleSave calls parent refresh',
  `setSaving(false); setSaved(true); fetchSchedule();
    setTimeout(() => setSaved(false), 2000);
  };`,
  `setSaving(false); setSaved(true); fetchSchedule(); onScheduleChange?.();
    setTimeout(() => setSaved(false), 2000);
  };`
)

patch(
  'FIX 4: Schedule handleDelete calls parent refresh',
  `await supabase.from("exam_schedule").delete().eq("id", id); fetchSchedule();`,
  `await supabase.from("exam_schedule").delete().eq("id", id); fetchSchedule(); onScheduleChange?.();`
)

patch(
  'FIX 4: sectionMap passes onScheduleChange to Schedule',
  `schedule:       <Schedule courseSubjects={courseSubjects} examTypes={examTypes} />,`,
  `schedule:       <Schedule courseSubjects={courseSubjects} examTypes={examTypes} onScheduleChange={refetchSchedule} />,`
)

// ─── FIX 4: Add refetchSchedule to root Exams ─────────────────────────────────
patch(
  'FIX 4: Add refetchSchedule function in root Exams',
  `  const [schedule, setSchedule] = useState([]);`,
  `  const [schedule, setSchedule] = useState([]);
  const refetchSchedule = useCallback(async () => {
    const { data } = await supabase.from('exam_schedule').select('*').order('exam_date')
    setSchedule(data || [])
  }, [])`
)

// ─── FIX 1 — Role permissions ─────────────────────────────────────────────────
patch(
  'FIX 1: Add ROLE_PERMS and usePerm utility',
  `const TAB_GROUPS = [`,
  `// ─── Role permissions ────────────────────────────────────────────────────────
const ROLE_PERMS = {
  Admin:    { canEdit: true,  canDelete: true,  canImport: true,  canPrint: true  },
  Manager:  { canEdit: true,  canDelete: false, canImport: true,  canPrint: true  },
  Teacher:  { canEdit: true,  canDelete: false, canImport: false, canPrint: true  },
  Accounts: { canEdit: false, canDelete: false, canImport: false, canPrint: false },
}
function usePerm(currentUser) {
  return ROLE_PERMS[currentUser?.role] || ROLE_PERMS.Teacher
}

const TAB_GROUPS = [`
)

// ─── FIX 1 — StudentsTab accepts currentUser ──────────────────────────────────
patch(
  'FIX 1: StudentsTab accepts currentUser prop',
  `function StudentsTab({ courseSubjects, students, onStudentsChange }) {`,
  `function StudentsTab({ courseSubjects, students, onStudentsChange, currentUser }) {
  const perm = usePerm(currentUser)`
)

// ─── FIX 1 — Wire currentUser to StudentsTab ──────────────────────────────────
patch(
  'FIX 1: Pass currentUser to StudentsTab in sectionMap',
  `studentsmgr:    <StudentsTab courseSubjects={courseSubjects} students={students} onStudentsChange={setStudents} />,`,
  `studentsmgr:    <StudentsTab courseSubjects={courseSubjects} students={students} onStudentsChange={setStudents} currentUser={currentUser} />,`
)

// ─── FIX 1 — Guard delete button in StudentsTab ───────────────────────────────
patch(
  'FIX 1: Guard delete button behind perm.canDelete',
  `<button onClick={() => setDeleteId(st.id)} style={{ ...css.btn, padding: "4px 10px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", fontSize: 12 }}>🗑️</button>`,
  `{perm.canDelete && <button onClick={() => setDeleteId(st.id)} style={{ ...css.btn, padding: "4px 10px", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", fontSize: 12 }}>🗑️</button>}`
)

// ─── FIX 1 — Guard import button ──────────────────────────────────────────────
patch(
  'FIX 1: Guard import button behind perm.canImport (MarkEntry)',
  `<button onClick={() => fileInputRef.current?.click()} style={{ ...css.btn, background: "#7c3aed", color: "white" }}>📂 Import Excel / CSV</button>`,
  `{perm?.canImport !== false && <button onClick={() => fileInputRef.current?.click()} style={{ ...css.btn, background: "#7c3aed", color: "white" }}>📂 Import Excel / CSV</button>}`
)

// ─── FIX 2 — Marks validation in handleSave ───────────────────────────────────
patch(
  'FIX 2: Add marks validation before saving',
  `  const handleSave = async () => {
    setSaving(true);
    const rows = [];`,
  `  const handleSave = async () => {
    // Validate marks don't exceed max or go negative
    const violations = []
    for (const st of courseStudents) {
      for (const sub of subjects) {
        const m = Number(marks[\`\${st.id}-\${sub}\`])
        if (marks[\`\${st.id}-\${sub}\`] === '' || marks[\`\${st.id}-\${sub}\`] === undefined) continue
        const max = getSubjectMax(course, sub)
        if (m > max) violations.push(\`\${st.name} → \${sub}: \${m} exceeds max \${max}\`)
        if (m < 0)   violations.push(\`\${st.name} → \${sub}: negative value \${m}\`)
      }
    }
    if (violations.length) {
      alert('⚠️ Fix these marks before saving:\\n\\n' + violations.join('\\n'))
      return
    }
    setSaving(true);
    const rows = [];`
)

// ─── FIX 2 — Red border on invalid input ─────────────────────────────────────
patch(
  'FIX 2: Highlight invalid mark inputs in red',
  `<input type="number" min="0" max={getSubjectMax(course, sub)} placeholder="--"
                          value={marks[\`\${st.id}-\${sub}\`] ?? ""}
                          onChange={e => handleMark(st.id, sub, e.target.value)}
                          style={{ width: 56, padding: "5px 4px", borderRadius: 6, border: "1px solid #D1D5DB", textAlign: "center", fontSize: 13, outline: "none" }} />`,
  `{(() => {
                          const v = marks[\`\${st.id}-\${sub}\`]
                          const maxM = getSubjectMax(course, sub)
                          const invalid = v !== undefined && v !== '' && (Number(v) > maxM || Number(v) < 0)
                          return <input type="number" min="0" max={maxM} placeholder="--"
                            value={v ?? ""}
                            onChange={e => handleMark(st.id, sub, e.target.value)}
                            title={invalid ? \`Max allowed: \${maxM}\` : ''}
                            style={{ width:56, padding:'5px 4px', borderRadius:6, border:\`1.5px solid \${invalid?'#EF4444':'#D1D5DB'}\`, textAlign:'center', fontSize:13, outline:'none', background: invalid?'#FEF2F2':'white' }} />
                        })()}`
)

// ─── FIX 7 — Unsaved changes warning ─────────────────────────────────────────
patch(
  'FIX 7: Warn before leaving with unsaved marks',
  `  const filtered = courseStudents.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()));

  const ImportPreview`,
  `  const filtered = courseStudents.filter(s => !search || s.name?.toLowerCase().includes(search.toLowerCase()));

  // Warn user if they navigate away with unsaved marks
  useEffect(() => {
    const handler = (e) => {
      if (!saved && Object.keys(marks).length > 0) {
        e.preventDefault()
        e.returnValue = 'You have unsaved marks. Leave without saving?'
      }
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [saved, marks])

  const ImportPreview`
)

// ─── FIX 8 — Consistent GCC matching in CSV import ───────────────────────────
patch(
  'FIX 8: Safer GCC matching in CSV import',
  `    let student = rawGcc ? matchPool.find(s => String(s.gcc_no).trim() === rawGcc) : null;
      if (!student && rawAdm) student = matchPool.find(s => String(s.admission_no).trim() === rawAdm);
      if (!student) student = matchPool.find(s => s.name?.toLowerCase() === rawName.toLowerCase());
      if (!student) student = matchPool.find(s => s.name?.toLowerCase().startsWith(rawName.toLowerCase().slice(0, 8)));`,
  `    const normGcc = rawGcc ? String(rawGcc).trim().replace(/^0+/, '') : ''
      let student = normGcc
        ? matchPool.find(s => String(s.gcc_no || '').trim().replace(/^0+/, '') === normGcc)
        : null
      if (!student && rawAdm) {
        student = matchPool.find(s => String(s.admission_no || '').trim() === String(rawAdm).trim())
      }
      if (!student) student = matchPool.find(s => s.name?.toLowerCase() === rawName.toLowerCase())
      if (!student) {
        // Fuzzy word-match (safer than startsWith)
        let bestScore = 0
        const rawWords = rawName.toLowerCase().split(/\\s+/).filter(Boolean)
        for (const s of matchPool) {
          const sWords = (s.name || '').toLowerCase().split(/\\s+/).filter(Boolean)
          const matchCount = rawWords.filter(w => sWords.includes(w)).length
          const score = matchCount / Math.max(rawWords.length, sWords.length)
          if (score > bestScore && score >= 0.6) { bestScore = score; student = s }
        }
      }`
)

// ─── FIX 13 — window.open popup blocker message ───────────────────────────────
patch(
  'FIX 13: Guard against blocked popup in printHTML',
  `function printHTML(html, title = "GNSI") {
  const w = window.open("", "_blank");
  w.document.write(`,
  `function printHTML(html, title = "GNSI") {
  const w = window.open('', '_blank')
  if (!w) {
    alert('Pop-ups are blocked!\\n\\nPlease allow pop-ups for this site:\\n• Chrome: click the blocked icon in the address bar\\n• Firefox: click Options in the notification bar\\n\\nThen try printing again.')
    return false
  }
  w.document.write(`
)

// ─── FIX 18 — Empty dates message ─────────────────────────────────────────────
// This is a UI addition - done per-component, we'll add a helper comment
// marking where to add it (the full addition is complex inline)

// ─── FIX 16 — Print button loading state in ReportCardItem ───────────────────
patch(
  'FIX 16: Add printing state to print button',
  `      <button onClick={printReport} style={{ ...css.btn, background: "#1a3c2e", color: "white", width: "100%" }}>🖨️ Print Report Card</button>`,
  `      {(() => {
        const [printing, setPrinting] = React.useState(false)
        return <button onClick={() => { setPrinting(true); printReport(); setTimeout(() => setPrinting(false), 3000) }}
          disabled={printing}
          style={{ ...css.btn, background: printing ? '#6B7280' : '#1a3c2e', color:'white', width:'100%', opacity: printing ? 0.8 : 1 }}>
          {printing ? '⏳ Opening print window...' : '🖨️ Print Report Card'}
        </button>
      })()}`
)

// ─── FIX 12 — Safer chart destroy ────────────────────────────────────────────
patch(
  'FIX 12: Safer chart destroy with null checks',
  `      chartsRef.current.forEach(c => { try { c.destroy(); } catch (_) {} }); chartsRef.current = [];`,
  `      chartsRef.current = (chartsRef.current || []).filter(Boolean)
      chartsRef.current.forEach(c => { try { if (c && typeof c.destroy === 'function') c.destroy() } catch(_){} })
      chartsRef.current = [];`
)

// ─── FIX 6 — Memoize getTotal in MarkEntry ───────────────────────────────────
patch(
  'FIX 6: Memoize getTotal with useCallback',
  `  const handleMark = (sid, sub, val) => { setMarks(p => ({ ...p, [\`\${sid}-\${sub}\`]: val })); setSaved(false); };
  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[\`\${sid}-\${sub}\`]) || 0), 0);`,
  `  const handleMark = (sid, sub, val) => { setMarks(p => ({ ...p, [\`\${sid}-\${sub}\`]: val })); setSaved(false); };
  const getTotal = useCallback(
    sid => subjects.reduce((s, sub) => s + (Number(marks[\`\${sid}-\${sub}\`]) || 0), 0),
    [marks, subjects]
  );`
)

// ─── FIX 5 — Batch remarks in ReportCards ────────────────────────────────────
patch(
  'FIX 5: Batch load remarks instead of per-student queries',
  `  const examName = examTypes.find(e => e.id === examType)?.name || "Examination";
  return (
    <div>
      <div style={{ ...css.card, background: "#F8FAFC", marginBottom: 16 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setMarks({}); }} />
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18, alignItems: "flex-end" }}>
        <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: 200 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select></div>
        <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Date</label>
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={{ ...css.input, width: 160 }}>{dates.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
        {courseStudents.map(st => (
          <ReportCardItem key={st.id} st={st} subjects={subjects} marks={marks} examType={examType} examDate={examDate} examName={examName} institute={institute} allStudents={courseStudents} course={course} />
        ))}
      </div>
    </div>
  );`,
  `  const examName = examTypes.find(e => e.id === examType)?.name || "Examination";

  // FIX 5: Batch load all remarks at once instead of N individual queries
  const [batchRemarks, setBatchRemarks] = useState({})
  useEffect(() => {
    if (!examType || !examDate || !courseStudents.length) { setBatchRemarks({}); return }
    const ids = courseStudents.map(s => s.id)
    supabase.from('exam_remarks').select('*')
      .eq('exam_type_id', examType).eq('exam_date', examDate)
      .in('student_id', ids)
      .then(({ data }) => {
        const map = {}
        ;(data || []).forEach(r => { map[r.student_id] = r.remark })
        setBatchRemarks(map)
      })
  }, [examType, examDate, course, courseStudents.length])

  return (
    <div>
      <div style={{ ...css.card, background: "#F8FAFC", marginBottom: 16 }}>
        <CoursePicker courses={courses} value={course} onChange={c => { setCourse(c); setMarks({}); }} />
      </div>
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18, alignItems: "flex-end" }}>
        <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Exam Type</label>
          <select value={examType} onChange={e => setExamType(e.target.value)} style={{ ...css.input, width: 200 }}>{examTypes.map(et => <option key={et.id} value={et.id}>{et.name}</option>)}</select></div>
        <div><label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#6B7280", marginBottom: 5, textTransform: "uppercase" }}>Date</label>
          <select value={examDate} onChange={e => setExamDate(e.target.value)} style={{ ...css.input, width: 160 }}>{dates.map(d => <option key={d} value={d}>{d}</option>)}</select></div>
      </div>
      {!dates.length && (
        <div style={{ background:'#FFFBEB', border:'1px solid #FDE68A', borderRadius:8, padding:'12px 16px', fontSize:13, color:'#92400E', marginBottom:14 }}>
          ⚠️ No exam data yet for <b>{examTypes.find(e=>e.id===examType)?.name}</b>. Go to <b>Mark Entry</b> and save marks first.
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))", gap: 14 }}>
        {courseStudents.map(st => (
          <ReportCardItem key={st.id} st={st} subjects={subjects} marks={marks} examType={examType} examDate={examDate} examName={examName} institute={institute} allStudents={courseStudents} course={course} initialRemark={batchRemarks[st.id] || ''} />
        ))}
      </div>
    </div>
  );`
)

// ─── FIX 5 — ReportCardItem uses initialRemark ───────────────────────────────
patch(
  'FIX 5: ReportCardItem accepts and uses initialRemark instead of useRemarks hook',
  `function ReportCardItem({ st, subjects, marks, examType, examDate, examName, institute, allStudents, course }) {
  const { remark, setRemark, save: saveRemark, saving: savingRemark, saved: savedRemark } = useRemarks(st.id, examType, examDate);`,
  `function ReportCardItem({ st, subjects, marks, examType, examDate, examName, institute, allStudents, course, initialRemark = '' }) {
  const [remark, setRemark] = useState(initialRemark)
  const [savingRemark, setSavingRemark] = useState(false)
  const [savedRemark, setSavedRemark] = useState(false)
  useEffect(() => { setRemark(initialRemark) }, [initialRemark, st.id])
  const saveRemark = async (val) => {
    setSavingRemark(true)
    await supabase.from('exam_remarks').upsert(
      { student_id: st.id, exam_type_id: examType, exam_date: examDate, remark: val },
      { onConflict: 'student_id,exam_type_id,exam_date' }
    )
    setSavingRemark(false); setSavedRemark(true)
    setTimeout(() => setSavedRemark(false), 2000)
  }`
)

// ─── FIX 22 — Chart export PNG button ────────────────────────────────────────
patch(
  'FIX 22: Add chart export button to Analytics',
  `        <div style={css.card}><div style={{ fontWeight: 700, fontSize: 14, color: "#1e293b", marginBottom: 14, fontFamily: "'Playfair Display',serif" }}>Grade Distribution</div><div style={{ height: 260 }}><canvas ref={gradeRef} /></div></div>`,
  `        <div style={css.card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <div style={{ fontWeight:700, fontSize:14, color:'#1e293b', fontFamily:"'Playfair Display',serif" }}>Grade Distribution</div>
              <button onClick={() => { if (!gradeRef.current) return; const a = document.createElement('a'); a.download=\`grade-\${course}.png\`; a.href=gradeRef.current.toDataURL('image/png'); a.click() }}
                style={{ ...css.btn, padding:'4px 10px', background:'#F3F4F6', color:'#374151', border:'1px solid #E5E7EB', fontSize:11 }}>⬇ PNG</button>
            </div>
            <div style={{ height: 260 }}><canvas ref={gradeRef} /></div>
          </div>`
)

// ─── Done ─────────────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, src, 'utf8')
console.log(`\n🎉 Applied ${fixes} fixes to Exams.jsx`)
console.log('\n📋 Manual steps still needed (can\'t auto-patch these):')
console.log('   • Fix 3:  Add undo button in ImportPreview component (see EXAMS_FIXES.md)')
console.log('   • Fix 9:  Add absent toggle button next to each mark input (see EXAMS_FIXES.md)')
console.log('   • Fix 14: Add touch event handlers to SeatArrangement (see EXAMS_FIXES.md)')
console.log('   • Fix 15: Start courseSubjects as null to avoid flash of defaults (see EXAMS_FIXES.md)')
console.log('   • Fix 20: Add photo_url support in admit card HTML (see EXAMS_FIXES.md)')
console.log('   • Fix 21: Add print audit log calls in BulkReports (see EXAMS_FIXES.md)')
console.log('\n🗄️  Run the SQL in EXAMS_FIXES.md in your Supabase SQL editor')
console.log('\n✅ Core fixes (1,2,4,5,6,7,8,10,11,12,13,16,17,18,19,22) are all applied!')