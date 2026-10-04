// Printed report card in the shared A4 receipt design (premiumReceipt.js).
// Used by staff (Exams.jsx) and by the Parents Portal so both print the same
// document. `getGrade(pct)` is passed in so each caller keeps its own scale.
import { receiptSheet, receiptHeader, esc } from './premiumReceipt'

// ─── Report card print — same A4 design as the fee receipt (premiumReceipt.js) ─
// Letterhead · REPORT CARD band · boxed candidate grid · subject table ·
// totals block · result stamp · remarks · signatures.
export const REPORT_CARD_CSS = `
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
export function buildReportCardHTML(st, subjects, subjectMaxMap, courseMax, marksMap, course, allStudents, examName, examDate, institute, remarkText, getGrade) {
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
const rcEsc = esc;

