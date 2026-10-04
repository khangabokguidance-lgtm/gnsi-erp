// ─────────────────────────────────────────────────────────────────
// GNSI Portal — admitCardTemplate.js
// Admit card in the shared A4 design used by fee receipts and report cards
// (premiumReceipt.js): letterhead · ADMIT CARD band · boxed candidate grid ·
// schedule table · instructions · signatures.
// ─────────────────────────────────────────────────────────────────
import { receiptDocument, receiptSheet, receiptHeader, openReceiptWindow, esc } from './premiumReceipt'

export const ADMIT_CARD_CSS = `
  .ac-photo{width:100px;height:120px;border:1.5px dashed #94A3B8;border-radius:6px;display:flex;align-items:center;justify-content:center;text-align:center;font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#64748B;line-height:1.5}
  .ac-warn{margin-top:10px;border:1px solid #F3C9C4;background:#FDF0EE;color:#B42318;border-radius:6px;padding:6px 10px;font-size:10.5px;font-weight:700;text-align:center}
  .ac-sec{font-size:9.5px;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:#334155;margin:12px 0 5px}
`;

export function generateAdmitCardHTML(student, { examTypeName, examSchedule = [], institute, course }) {
  const scheduleRows = examSchedule
    .filter(s => !s.course || s.course.toUpperCase() === (course || "").toUpperCase())
    .sort((a, b) => a.exam_date > b.exam_date ? 1 : -1)
    .map((s, i) => `<tr>
        <td>${i + 1}</td><td>${esc(s.exam_date || "—")}</td><td style="font-weight:700">${esc(s.subject || "—")}</td>
        <td>${esc(s.shift || "Morning")}</td><td>${esc(s.time || "—")}</td><td>${esc(s.room || "—")}</td>
        <td class="r mono">${esc(s.total_marks || "—")}</td></tr>`)
    .join("");

  const roll = String(student.gcc_no || "").padStart(6, "0");
  const ticketCode = `GNSI-${roll}-${(examTypeName || "EXAM").replace(/\s+/g, "").toUpperCase().slice(0, 7)}`;
  const year = institute?.academicYear || "2026-2027";
  const cell = (l, v, extra = "") => `<td class="c"${extra}><div class="l">${l}</div><div class="v">${v}</div></td>`;

  const body = `
    <div class="wrap">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:12px">
        <div><div class="l">Examination</div><div style="font-size:16px;font-weight:700;color:#0B1E3D;margin-top:2px">${esc(examTypeName || "Examination")}</div></div>
        <div style="text-align:center"><div class="l">Hall Ticket No.</div><div class="mono" style="font-size:14px;font-weight:700;margin-top:2px">${esc(ticketCode)}</div></div>
        <div style="text-align:right"><div class="l">Academic year</div><div style="font-size:13px;font-weight:700;margin-top:2px">${esc(year)}</div></div>
      </div>
      <table class="info"><tbody>
        <tr>${cell("Candidate Name", esc(student.name || "—"), ' colspan="3"')}<td class="c" rowspan="3" style="width:25%;text-align:center;vertical-align:middle"><div class="ac-photo" style="margin:0 auto">Affix<br/>passport<br/>size photo</div></td></tr>
        <tr>${cell("Roll / GCC No.", `<span class="mono">GCC-${esc(roll)}</span>`)}${cell("Admission No.", esc(student.admission_no && student.admission_no !== "--" ? student.admission_no : "—"), ' colspan="2"')}</tr>
        <tr>${cell("Course", esc(student.course || course || "—"))}${cell("Batch", esc(student.class_name || "—"), ' colspan="2"')}</tr>
      </tbody></table>
      <div class="ac-warn">This admit card must be produced at the examination hall. Without it, entry will not be permitted.</div>
      ${scheduleRows ? `<div class="ac-sec">Examination schedule</div>
      <table class="items"><thead><tr><th style="width:36px">#</th><th>Date</th><th>Subject</th><th>Shift</th><th>Time</th><th>Room / Hall</th><th class="r">Max marks</th></tr></thead>
      <tbody>${scheduleRows}</tbody></table>` : ""}
      <div class="instr" style="grid-template-columns:1fr"><div><h4>📋 Important instructions</h4><ol>
        <li>Bring this admit card to every examination session.</li>
        <li>Report to the examination hall at least <b>15 minutes</b> before the scheduled time.</li>
        <li>Mobile phones and electronic gadgets are strictly prohibited in the hall.</li>
        <li>Only permitted stationery (pen, pencil, eraser, sharpener) is allowed.</li>
        <li>OMR sheets must be filled with a blue/black ballpoint pen only.</li>
      </ol></div></div>
      <div class="foot" style="padding-top:34px">
        <div class="sig"><div class="line"></div><div class="l">Candidate's signature</div></div>
        <div class="sig"><div class="line"></div><div class="l">Exam coordinator</div></div>
        <div class="sig"><div class="line"></div><div class="l">Head of institute</div></div>
      </div>
    </div>`;
  return receiptSheet(receiptHeader("ADMIT CARD", `${examTypeName || "Examination"} · ${year}`) + body,
    `Issued: ${new Date().toLocaleDateString("en-IN")}`, "For queries contact the Institute Office");
}

export function openAdmitCardPrintWindow(cardHTMLArray, title = "Admit Cards") {
  openReceiptWindow(title, receiptDocument(title, cardHTMLArray.join(""), {
    extraCss: ADMIT_CARD_CSS,
    printLabel: `🖨 Print ${cardHTMLArray.length > 1 ? `all (${cardHTMLArray.length}) admit cards` : "admit card"}`,
  }), { autoPrint: false });
}
