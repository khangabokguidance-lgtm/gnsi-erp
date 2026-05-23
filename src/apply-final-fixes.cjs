/**
 * apply-final-fixes.cjs
 * Fixes: Absent toggle, Touch seats, Photo URL, Print audit log
 * Run: node src/apply-final-fixes.cjs  (from project root)
 */

const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, 'Exams.jsx')
let src = fs.readFileSync(FILE, 'utf8')
let fixes = 0

function patch(desc, find, replace) {
  if (!src.includes(find)) { console.warn(`⚠️  SKIP: ${desc}`); return }
  src = src.replace(find, replace)
  fixes++
  console.log(`✅ ${desc}`)
}

// ─── FIX 9: Absent toggle ────────────────────────────────────────────────────
// Add absentSet state after importDone state in MarkEntry
patch(
  'FIX 9: Add absentSet state',
  `  const [importDone, setImportDone] = useState(false);
  const fileInputRef = useRef(null);`,
  `  const [importDone, setImportDone] = useState(false);
  const [absentSet, setAbsentSet] = useState(new Set());
  const fileInputRef = useRef(null);`
)

// Add toggleAbsent function after handleMark
patch(
  'FIX 9: Add toggleAbsent function',
  `  const handleMark = (sid, sub, val) => { setMarks(p => ({ ...p, [\`\${sid}-\${sub}\`]: val })); setSaved(false); };
  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[\`\${sid}-\${sub}\`]) || 0), 0);`,
  `  const handleMark = (sid, sub, val) => { setMarks(p => ({ ...p, [\`\${sid}-\${sub}\`]: val })); setSaved(false); };
  const toggleAbsent = (sid, sub) => {
    const key = \`\${sid}-\${sub}\`
    setAbsentSet(prev => {
      const next = new Set(prev)
      if (next.has(key)) { next.delete(key) }
      else { next.add(key); setMarks(p => ({ ...p, [key]: 0 })); setSaved(false) }
      return next
    })
  }
  const getTotal = sid => subjects.reduce((s, sub) => s + (Number(marks[\`\${sid}-\${sub}\`]) || 0), 0);`
)

// Add is_absent to save rows
patch(
  'FIX 9: Save is_absent flag',
  `          total_marks: getSubjectMax(course, sub),
          exam_date: examDate,
        });`,
  `          total_marks: getSubjectMax(course, sub),
          exam_date: examDate,
          is_absent: absentSet.has(\`\${st.id}-\${sub}\`),
        });`
)

// Add absent button next to mark input
patch(
  'FIX 9: Add absent toggle button in mark input cell',
  `                      <input type="number" min="0" max={getSubjectMax(course, sub)} placeholder="--"
                          value={marks[\`\${st.id}-\${sub}\`] ?? ""}
                          onChange={e => handleMark(st.id, sub, e.target.value)}
                          style={{ width: 56, padding: "5px 4px", borderRadius: 6, border: "1px solid #D1D5DB", textAlign: "center", fontSize: 13, outline: "none" }} />`,
  `                      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                        <input type="number" min="0" max={getSubjectMax(course, sub)} placeholder="--"
                          value={marks[\`\${st.id}-\${sub}\`] ?? ""}
                          onChange={e => handleMark(st.id, sub, e.target.value)}
                          style={{ width:56, padding:'5px 4px', borderRadius:6, border:\`1px solid \${absentSet.has(\`\${st.id}-\${sub}\`) ? '#FCA5A5' : '#D1D5DB'}\`, textAlign:'center', fontSize:13, outline:'none', background: absentSet.has(\`\${st.id}-\${sub}\`) ? '#FEF2F2' : 'white' }} />
                        <button onClick={() => toggleAbsent(st.id, sub)} title="Mark Absent"
                          style={{ fontSize:8, padding:'1px 4px', borderRadius:3, border:'1px solid #FECACA', background: absentSet.has(\`\${st.id}-\${sub}\`) ? '#FCA5A5' : '#F9FAFB', color: absentSet.has(\`\${st.id}-\${sub}\`) ? '#DC2626' : '#9CA3AF', cursor:'pointer', fontWeight:700, lineHeight:1.4 }}>
                          {absentSet.has(\`\${st.id}-\${sub}\`) ? 'ABS' : 'A'}
                        </button>
                      </div>`
)

// ─── FIX 14: Touch support for seat drag ─────────────────────────────────────
patch(
  'FIX 14: Add touchDragStudent state in SeatArrangement',
  `  const [dragStudent, setDragStudent] = useState(null);`,
  `  const [dragStudent, setDragStudent] = useState(null);
  const [touchDragStudent, setTouchDragStudent] = useState(null);`
)

// Add touch handlers to student list items
patch(
  'FIX 14: Add touch handlers to student list items',
  `                    draggable={!inRoom}
                    onDragStart={()=>setDragStudent(st)}
                    onDragEnd={()=>setDragStudent(null)}`,
  `                    draggable={!inRoom}
                    onDragStart={()=>setDragStudent(st)}
                    onDragEnd={()=>setDragStudent(null)}
                    onTouchStart={()=>{ if(!inRoom) setTouchDragStudent(st) }}
                    onTouchEnd={()=>setTouchDragStudent(null)}`
)

// Add touch drop to seat cells
patch(
  'FIX 14: Add touch drop handler to seat cells',
  `                          onDragOver={e=>{e.preventDefault();}}
                          onDrop={e=>{ e.preventDefault(); if(dragStudent && !assignedInRoom.has(dragStudent.id)){ setSeats(p=>({...p,[seatNum]:dragStudent.id})); setSaved(false); setDragStudent(null); }}}`,
  `                          onDragOver={e=>{e.preventDefault();}}
                          onDrop={e=>{ e.preventDefault(); if(dragStudent && !assignedInRoom.has(dragStudent.id)){ setSeats(p=>({...p,[seatNum]:dragStudent.id})); setSaved(false); setDragStudent(null); }}}
                          onTouchEnd={e=>{ e.preventDefault(); if(touchDragStudent && !assignedInRoom.has(touchDragStudent.id)){ setSeats(p=>({...p,[seatNum]:touchDragStudent.id})); setSaved(false); setTouchDragStudent(null); }}}`
)

// Add touch indicator banner
patch(
  'FIX 14: Add touch drag indicator',
  `          {/* Legend */}
          <div style={{ display:"flex", gap:16, marginTop:12, fontSize:12, color:"#64748b" }}>`,
  `          {touchDragStudent && (
            <div style={{ position:'fixed', bottom:80, left:'50%', transform:'translateX(-50%)', background:'#1a3c2e', color:'white', borderRadius:10, padding:'10px 20px', fontSize:13, fontWeight:700, zIndex:9999, pointerEvents:'none', whiteSpace:'nowrap' }}>
              Tap a seat to place: {touchDragStudent.name.split(' ')[0]}
            </div>
          )}
          {/* Legend */}
          <div style={{ display:"flex", gap:16, marginTop:12, fontSize:12, color:"#64748b" }}>`
)

// ─── FIX 20: Photo URL in admit card ─────────────────────────────────────────
// In AdmitCardsTab generateCardHTML photo box
patch(
  'FIX 20: Photo URL in AdmitCardsTab individual card',
  `        <div class="photo-box">
          <div class="photo-inner"><div class="photo-text">Affix<br/>Passport<br/>Photo</div></div>
          <div class="photo-label">Photograph</div>
        </div>
      </div>
      <div class="gold-divider mini"><div class="gold-line"></div><div class="gold-diamond">◆</div><div class="gold-line"></div></div>
      <div class="schedule-section">
        <div class="section-title">📅 Examination Schedule</div>`,
  `        <div class="photo-box">
          <div class="photo-inner" style="${''}">
            \${st.photo_url
              ? \`<img src="\${st.photo_url}" style="width:100%;height:100%;object-fit:cover;border-radius:4px"/>\`
              : \`<div class="photo-text">Affix<br/>Passport<br/>Photo</div>\`}
          </div>
          <div class="photo-label">Photograph</div>
        </div>
      </div>
      <div class="gold-divider mini"><div class="gold-line"></div><div class="gold-diamond">◆</div><div class="gold-line"></div></div>
      <div class="schedule-section">
        <div class="section-title">📅 Examination Schedule</div>`
)

// ─── FIX 21: Print audit log ─────────────────────────────────────────────────
// Log when bulk report cards are printed
patch(
  'FIX 21: Print audit log in printAllReportCards',
  `  // ── Print all report cards ──
  const printAllReportCards = async () => {
    setRcProgress({ current: 0, total: filteredRcStudents.length });`,
  `  // ── Print all report cards ──
  const printAllReportCards = async () => {
    setRcProgress({ current: 0, total: filteredRcStudents.length });
    // Audit log
    try {
      await supabase.from('exam_print_log').insert({
        user_name: 'Admin',
        doc_type: 'report_card',
        course: rcCourse,
        exam_type: examTypes.find(e=>e.id===rcExamType)?.name || rcExamType,
        student_count: filteredRcStudents.length,
      })
    } catch(_) {}`
)

// Log when bulk admit cards are printed
patch(
  'FIX 21: Print audit log in printAllAdmitCards',
  `  const printAllAdmitCards = async () => {
    setAcProgress({ current: 0, total: filteredAcStudents.length });`,
  `  const printAllAdmitCards = async () => {
    setAcProgress({ current: 0, total: filteredAcStudents.length });
    // Audit log
    try {
      await supabase.from('exam_print_log').insert({
        user_name: 'Admin',
        doc_type: 'admit_card',
        course: acCourse,
        exam_type: acExamName,
        student_count: filteredAcStudents.length,
      })
    } catch(_) {}`
)

fs.writeFileSync(FILE, src, 'utf8')
console.log(`\n🎉 Applied ${fixes} fixes to Exams.jsx`)
console.log('\nRun SQL in Supabase:')
console.log('  ALTER TABLE students ADD COLUMN IF NOT EXISTS photo_url text;')
console.log('  ALTER TABLE exam_marks ADD COLUMN IF NOT EXISTS is_absent boolean DEFAULT false;')