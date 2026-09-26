// entrancePrint.js — GNSI Portal
// Printable documents for the entrance exam: hall tickets, attendance
// sheets, question booklets, answer keys, OMR sheets, merit lists,
// scorecards and admission offer letters. Every value is HTML-escaped —
// the print window shares the portal's origin, so an unescaped candidate
// name could run script with the staff session.

import { esc, fmtDate, hallTicketNo, sectionRanges } from './entranceCore'

const INSTITUTE = 'Guidance Navodaya & Sainik Institute'
const ADDRESS = 'Khangabok, Thoubal, Manipur'

const BASE_CSS = `
  @page { size: A4; margin: 12mm }
  * { box-sizing: border-box }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f1b2e; margin: 0; font-size: 12px }
  .page { page-break-after: always }
  .page:last-child { page-break-after: auto }
  .crest { display:flex; align-items:center; justify-content:space-between; background:#132a4f; color:#fff; padding:12px 16px; border-bottom:3px solid #b8923a }
  .crest .n { font-family: Georgia, serif; font-size: 20px; font-weight: 700; letter-spacing: .06em }
  .crest .s { font-size: 10.5px; opacity: .8 }
  .crest .t { text-align:right; font-weight:700; font-size:14px; letter-spacing:.08em }
  h1,h2,h3 { font-family: Georgia, serif; margin: 0 }
  table.grid { width:100%; border-collapse:collapse }
  table.grid th, table.grid td { border:1px solid #c9c2b1; padding:6px 8px; text-align:left; font-size:11.5px }
  table.grid th { background:#f6efdc; font-size:10.5px; text-transform:uppercase; letter-spacing:.05em }
  .muted { color:#5d6b82 }
  .box { border:1.5px solid #132a4f; border-radius:10px; overflow:hidden }
  .foot { margin-top:10px; font-size:10px; color:#5d6b82; text-align:center }
`

// Open the print window synchronously (inside the click) so pop-up
// blockers allow it, then fill it once photos / QR codes are ready.
export function printWindow(title = 'Preparing…') {
  const win = window.open('', '_blank')
  if (!win) { alert('Allow pop-ups for this site to print.'); return null }
  win.document.write(`<!doctype html><title>${esc(title)}</title><p style="font:14px system-ui;padding:24px;color:#5d6b82">Preparing ${esc(title)}…</p>`)
  return win
}

export function openPrint(title, body, extraCss = '', win = null) {
  win = win || printWindow(title)
  if (!win) return
  win.document.open()
  win.document.write(wrapDoc(title, body, extraCss, true))
  win.document.close()
}

// Full HTML document (also used for on-screen previews in an iframe).
export function wrapDoc(title, body, extraCss = '', autoPrint = false) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>${BASE_CSS}${extraCss}</style></head><body>${body}
    ${autoPrint ? "<script>window.addEventListener('load',function(){setTimeout(function(){window.print()},350)})</script>" : ''}</body></html>`
}

const crest = (right, sub = 'Entrance Examination') => `
  <div class="crest"><div><div class="n">GNSI</div><div class="s">${INSTITUTE}</div><div class="s">${ADDRESS}</div></div>
  <div class="t">${esc(right)}<div class="s" style="font-weight:400;letter-spacing:0">${esc(sub)}</div></div></div>`

// ── Hall ticket ───────────────────────────────────────────────────────────────
export function hallTicketHtml(c, exam, { photo, qr } = {}) {
  const row = (k, v) => `<tr><td style="width:36%;color:#5d6b82;border:none;padding:3px 0">${k}</td><td style="border:none;padding:3px 0;font-weight:600">${esc(v || '—')}</td></tr>`
  const instructions = String(exam.instructions || '').split(/\n+/).filter(Boolean)
  const defaults = [
    'Bring this hall ticket and one photo identity proof. Entry is not allowed without them.',
    `Report at the centre by ${exam.reporting_time || '30 minutes before the exam'}. Late entry is not permitted after the exam starts.`,
    'Use only a blue/black ball-point pen to darken the OMR circles. Calculators, phones and smart watches are not allowed.',
    'Do not leave the hall before the exam ends. Any unfair means leads to disqualification.',
  ]
  return `<div class="page" style="padding:6mm 0">
    <div class="box">${crest('HALL TICKET', exam.exam_name)}
      <div style="display:flex;gap:16px;padding:14px 16px">
        <table style="flex:1;border-collapse:collapse;font-size:12.5px">
          ${row('Roll number', hallTicketNo(exam.id, c.roll_number))}
          ${row('Application no.', c.application_no)}
          ${row('Candidate name', c.student_name)}
          ${row("Father's name", c.father_name)}
          ${row("Mother's name", c.mother_name)}
          ${row('Date of birth', c.dob ? fmtDate(c.dob) : '')}
          ${row('Gender / Category', [c.gender, c.category].filter(Boolean).join(' · '))}
          ${row('Class applied', exam.class_target)}
        </table>
        <div style="width:120px;text-align:center">
          <div style="width:120px;height:150px;border:1.5px dashed #b8923a;border-radius:6px;display:flex;align-items:center;justify-content:center;overflow:hidden;background:#faf8f3">
            ${photo ? `<img src="${esc(photo)}" style="width:100%;height:100%;object-fit:cover">` : '<span class="muted" style="font-size:10px;padding:6px">Affix recent passport photo, attested</span>'}
          </div>
          ${qr ? `<img src="${esc(qr)}" style="width:92px;height:92px;margin-top:8px">` : ''}
        </div>
      </div>
      <table class="grid" style="margin:0 16px 12px;width:calc(100% - 32px)">
        <tr><th>Exam date</th><th>Reporting</th><th>Exam time</th><th>Duration</th><th>Centre</th><th>Room / Seat</th></tr>
        <tr><td>${esc(fmtDate(exam.exam_date))}</td><td>${esc(exam.reporting_time || '—')}</td><td>${esc(exam.exam_time || '—')}</td>
        <td>${esc(exam.duration_mins)} min</td><td>${esc(exam.venue || 'GNSI, Khangabok')}</td><td>${esc(c.room || '—')}${c.seat_no ? ` / ${esc(c.seat_no)}` : ''}</td></tr>
      </table>
      <div style="margin:0 16px 12px;background:#fff5e0;border:1px solid #eadbb2;border-radius:8px;padding:8px 12px;font-size:11px">
        <b>Instructions</b><ol style="margin:4px 0 0 16px;padding:0">${(instructions.length ? instructions : defaults).map(i => `<li>${esc(i)}</li>`).join('')}</ol>
      </div>
      <div style="display:flex;justify-content:space-between;padding:22px 16px 12px;font-size:11px">
        <div>Candidate's signature<br><br>________________</div>
        <div style="text-align:center">Parent's signature<br><br>________________</div>
        <div style="text-align:right">Invigilator's signature<br><br>________________</div>
        <div style="text-align:right">Controller of Examinations<br><br>________________</div>
      </div>
    </div></div>`
}

// ── Attendance sheet (one page per room) ──────────────────────────────────────
export function attendanceSheetHtml(exam, room, cands, photos = {}) {
  const rows = cands.map(c => `<tr style="height:46px">
    <td>${esc(c.seat_no || '')}</td><td style="font-family:monospace">${esc(hallTicketNo(exam.id, c.roll_number))}</td>
    <td>${photos[c.id] ? `<img src="${esc(photos[c.id])}" style="width:34px;height:42px;object-fit:cover">` : ''}</td>
    <td><b>${esc(c.student_name)}</b><div class="muted">${esc(c.father_name || '')}</div></td>
    <td>${esc(c.paper_set || 'A')}</td><td></td><td></td><td></td></tr>`).join('')
  return `<div class="page">${crest('ATTENDANCE SHEET', exam.exam_name)}
    <div style="display:flex;justify-content:space-between;margin:10px 0;font-size:12px">
      <div><b>Room:</b> ${esc(room)} &nbsp; <b>Date:</b> ${esc(fmtDate(exam.exam_date))} &nbsp; <b>Time:</b> ${esc(exam.exam_time || '')}</div>
      <div><b>Candidates:</b> ${cands.length}</div></div>
    <table class="grid"><thead><tr><th>Seat</th><th>Roll no.</th><th>Photo</th><th>Candidate</th><th>Set</th><th>Booklet no.</th><th>OMR no.</th><th>Signature</th></tr></thead>
    <tbody>${rows}</tbody></table>
    <div style="display:flex;justify-content:space-between;margin-top:18px;font-size:11px">
      <div>Present: ____ &nbsp; Absent: ____</div><div>Invigilator: ______________________</div></div></div>`
}

// Door notice: roll-number range per room.
export function seatingPlanHtml(exam, rooms) {
  const rows = rooms.map(r => `<tr><td><b>${esc(r.name)}</b></td><td style="font-family:monospace">${esc(r.from)} — ${esc(r.to)}</td><td>${r.count}</td></tr>`).join('')
  return `<div class="page">${crest('SEATING PLAN', exam.exam_name)}
    <h2 style="margin:16px 0 8px">${esc(fmtDate(exam.exam_date))} · ${esc(exam.exam_time || '')}</h2>
    <table class="grid" style="font-size:15px"><thead><tr><th>Room</th><th>Roll numbers</th><th>Candidates</th></tr></thead><tbody>${rows}</tbody></table></div>`
}

// ── Question booklet ──────────────────────────────────────────────────────────
export function paperHtml(exam, paper, set, sections) {
  const order = paper.order?.[set] || paper.order.A
  const key = order.map(i => ({ ...paper.questions[i] }))
  const ranges = sectionRanges(exam, key.map(q => ({ sec: q.sec, marks: q.marks })))
  const total = key.reduce((t, q) => t + q.marks, 0)
  let body = `<div class="page">${crest(`QUESTION BOOKLET · SET ${set}`, exam.exam_name)}
    <div style="display:flex;justify-content:space-between;margin:14px 0">
      <div style="font-size:13px"><b>Time:</b> ${esc(exam.duration_mins)} minutes &nbsp; <b>Maximum marks:</b> ${total}</div>
      <div style="border:2px solid #132a4f;padding:6px 18px;font-size:20px;font-weight:800;font-family:Georgia,serif">SET ${set}</div></div>
    <table class="grid" style="margin-bottom:12px"><tr><th>Roll number</th><td style="width:60%"></td></tr><tr><th>Candidate name</th><td></td></tr><tr><th>Invigilator signature</th><td></td></tr></table>
    <table class="grid"><thead><tr><th>Section</th><th>Questions</th><th>Q. numbers</th><th>Marks each</th><th>Marks</th></tr></thead><tbody>
      ${ranges.map(r => `<tr><td>${esc(r.name)}</td><td>${r.count}</td><td>${r.from}–${r.to}</td><td>${esc(r.marks_each)}</td><td>${r.max}</td></tr>`).join('')}</tbody></table>
    <div style="margin-top:14px;font-size:12px"><b>Instructions to candidates</b><ol>
      <li>Check that this booklet has ${key.length} questions and that the set code matches your OMR sheet.</li>
      <li>Each question has four options (A)–(D). Only one is correct. Darken that circle on the OMR sheet.</li>
      ${Number(exam.negative_marks) > 0 ? `<li>${esc(exam.negative_marks)} mark(s) will be deducted for every wrong answer.</li>` : '<li>There is no negative marking.</li>'}
      <li>Rough work may be done in this booklet only. Do not write on the OMR sheet except as instructed.</li>
    </ol></div>
    <div style="text-align:center;margin-top:30px;font-weight:700;letter-spacing:.1em">DO NOT OPEN THIS BOOKLET UNTIL TOLD TO DO SO</div></div>`
  body += '<div class="page" style="columns:2;column-gap:10mm;column-rule:1px solid #e8e3d8">'
  let curSec = -1
  key.forEach((q, i) => {
    if (q.sec !== curSec) {
      curSec = q.sec
      body += `<div style="break-inside:avoid;column-span:all;background:#132a4f;color:#fff;padding:6px 10px;margin:10px 0 8px;font-weight:700;letter-spacing:.05em;text-transform:uppercase">SECTION ${curSec + 1} · ${esc(sections[curSec]?.name || '')}</div>`
    }
    body += `<div style="break-inside:avoid;margin-bottom:10px;font-size:12px;line-height:1.45">
      <div><b>${i + 1}.</b> ${esc(q.q)}</div>
      ${q.img ? `<img src="${esc(q.img)}" style="max-width:100%;max-height:160px;margin:4px 0">` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2px 10px;margin-top:3px">
        <div>(A) ${esc(q.a)}</div><div>(B) ${esc(q.b)}</div>${q.c ? `<div>(C) ${esc(q.c)}</div>` : ''}${q.d ? `<div>(D) ${esc(q.d)}</div>` : ''}</div></div>`
  })
  body += '</div>'
  return body
}

export function answerKeyHtml(exam, keysBySet) {
  const pages = Object.entries(keysBySet).map(([set, key]) => {
    const cells = key.map((k, i) => `<td style="text-align:center"><div class="muted" style="font-size:9.5px">${i + 1}</div><b>${esc(k.correct || '?')}</b></td>`)
    const rows = []
    for (let i = 0; i < cells.length; i += 15) rows.push(`<tr>${cells.slice(i, i + 15).join('')}</tr>`)
    return `<div class="page">${crest(`ANSWER KEY · SET ${set}`, 'CONFIDENTIAL')}
      <h2 style="margin:14px 0 8px">${esc(exam.exam_name)}</h2><table class="grid">${rows.join('')}</table></div>`
  })
  return pages.join('')
}

// ── OMR answer sheet ──────────────────────────────────────────────────────────
export function omrSheetHtml(exam, n, cand) {
  const roll = cand ? hallTicketNo(exam.id, cand.roll_number) : ''
  const bubble = l => `<span style="display:inline-flex;width:15px;height:15px;border:1.3px solid #132a4f;border-radius:50%;align-items:center;justify-content:center;font-size:8.5px;margin:0 2px">${l}</span>`
  const perCol = 25
  const cols = []
  for (let s = 0; s < n; s += perCol) {
    const items = []
    for (let i = s; i < Math.min(n, s + perCol); i++) items.push(`<div style="display:flex;align-items:center;height:21px"><span style="width:28px;text-align:right;margin-right:6px;font-weight:700;font-size:10px">${i + 1}</span>${['A', 'B', 'C', 'D'].map(bubble).join('')}</div>`)
    cols.push(`<div style="border:1px solid #d9d2c2;border-radius:6px;padding:6px 8px">${items.join('')}</div>`)
  }
  return `<div class="page">${crest('OMR ANSWER SHEET', exam.exam_name)}
    <table class="grid" style="margin:10px 0"><tr><th>Roll number</th><td style="font-family:monospace;font-size:14px">${esc(roll)}</td><th>Set</th><td style="font-size:16px;font-weight:800">${esc(cand?.paper_set || '')}</td></tr>
    <tr><th>Candidate name</th><td>${esc(cand?.student_name || '')}</td><th>Signature</th><td></td></tr></table>
    <div class="muted" style="font-size:10.5px;margin-bottom:6px">Darken ONE circle per question completely with a blue/black ball-point pen. More than one circle counts as a wrong answer.</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:6px">${cols.join('')}</div>
    <div style="display:flex;justify-content:space-between;margin-top:14px;font-size:11px"><div>Invigilator: ______________</div><div>Checked by: ______________</div></div></div>`
}

// ── Merit list ────────────────────────────────────────────────────────────────
export function meritListHtml(exam, rows, sections, { title = 'MERIT LIST', showCategory = true } = {}) {
  const tr = rows.map(r => `<tr><td>${r.rank}</td>${showCategory ? `<td>${esc(r.category || 'General')} · ${r.category_rank}</td>` : ''}
    <td style="font-family:monospace">${esc(hallTicketNo(exam.id, r.roll_number))}</td><td><b>${esc(r.student_name)}</b><div class="muted">${esc(r.father_name || '')}</div></td>
    ${sections.map(s => `<td>${esc(r.scores?.[s.name] ?? '')}</td>`).join('')}<td><b>${esc(r.total)}</b></td><td>${esc(r.statusLabel || '')}</td></tr>`).join('')
  return `<div>${crest(title, exam.exam_name)}
    <div style="margin:10px 0" class="muted">Exam date ${esc(fmtDate(exam.exam_date))} · Qualifying marks ${esc(exam.passing_marks)} · Published ${esc(fmtDate(new Date()))}</div>
    <table class="grid"><thead><tr><th>Rank</th>${showCategory ? '<th>Category rank</th>' : ''}<th>Roll no.</th><th>Candidate</th>${sections.map(s => `<th>${esc(s.name)}</th>`).join('')}<th>Total</th><th>Status</th></tr></thead>
    <tbody>${tr}</tbody></table>
    <div class="foot">Ties are broken by section marks in paper order, then by age (older first).</div></div>`
}

// ── Scorecard ─────────────────────────────────────────────────────────────────
export function scorecardHtml(exam, r, sections, { qr } = {}) {
  const max = s => (Number(s.questions) || 0) * (Number(s.marks_each) || 0)
  const totalMax = sections.reduce((t, s) => t + max(s), 0)
  return `<div class="page" style="padding:6mm 0"><div class="box">${crest('SCORECARD', exam.exam_name)}
    <div style="display:flex;gap:16px;padding:14px 16px">
      <table style="flex:1;font-size:12.5px">
        <tr><td class="muted">Roll number</td><td><b>${esc(hallTicketNo(exam.id, r.roll_number))}</b></td></tr>
        <tr><td class="muted">Candidate</td><td><b>${esc(r.student_name)}</b></td></tr>
        <tr><td class="muted">Father's name</td><td>${esc(r.father_name || '—')}</td></tr>
        <tr><td class="muted">Category</td><td>${esc(r.category || 'General')}</td></tr>
      </table>${qr ? `<img src="${esc(qr)}" style="width:90px;height:90px">` : ''}</div>
    <table class="grid" style="margin:0 16px;width:calc(100% - 32px)"><thead><tr><th>Section</th><th>Max marks</th><th>Marks obtained</th></tr></thead><tbody>
      ${sections.map(s => `<tr><td>${esc(s.name)}</td><td>${max(s) || '—'}</td><td><b>${esc(r.scores?.[s.name] ?? '—')}</b></td></tr>`).join('')}
      <tr><th>Total</th><th>${totalMax || esc(exam.total_marks)}</th><th>${esc(r.total)}</th></tr></tbody></table>
    <div style="display:flex;gap:10px;margin:14px 16px">
      ${[['Overall rank', r.rank], [`${r.category || 'General'} rank`, r.category_rank], ['Correct', r.correct ?? '—'], ['Wrong', r.wrong ?? '—'], ['Result', r.qualified ? 'QUALIFIED' : 'NOT QUALIFIED']]
        .map(([k, v]) => `<div style="flex:1;border:1px solid #eadbb2;border-radius:8px;padding:8px;text-align:center;background:#faf8f3"><div class="muted" style="font-size:10px;text-transform:uppercase;letter-spacing:.06em">${esc(k)}</div><div style="font-size:16px;font-weight:800;margin-top:3px">${esc(v)}</div></div>`).join('')}
    </div>
    <div style="display:flex;justify-content:space-between;padding:22px 16px 14px;font-size:11px"><div>Date: ${esc(fmtDate(new Date()))}</div><div>Controller of Examinations</div></div>
  </div></div>`
}

// ── Offer letter ──────────────────────────────────────────────────────────────
export function offerLetterHtml(exam, r, { reportBy = '', fee = '' } = {}) {
  return `<div class="page">${crest('PROVISIONAL ADMISSION OFFER', exam.exam_name)}
    <div style="padding:18px 6px;font-size:13px;line-height:1.7">
      <div style="text-align:right">Date: ${esc(fmtDate(new Date()))}</div>
      <p>To,<br><b>${esc(r.student_name)}</b><br>C/o ${esc(r.father_name || '—')}<br>${esc(r.address || '')}</p>
      <p><b>Subject: Provisional admission — ${esc(exam.class_target || '')}</b></p>
      <p>We are pleased to inform you that, on the basis of the ${esc(exam.exam_name)} held on ${esc(fmtDate(exam.exam_date))},
      you have been selected for provisional admission. Roll number <b>${esc(hallTicketNo(exam.id, r.roll_number))}</b>,
      overall rank <b>${esc(r.rank)}</b>, seat under <b>${esc(r.quota || 'Open')}</b> category.</p>
      <p>Please report to the GNSI office ${reportBy ? `by <b>${esc(fmtDate(reportBy))}</b>` : 'within 7 days'} with the original documents listed below
      ${fee ? `and the admission fee of <b>₹${esc(fee)}</b>` : ''}. If you do not report in time, the seat will be offered to the next candidate on the waitlist.</p>
      <ol><li>This offer letter and the hall ticket</li><li>Birth certificate and previous school's transfer certificate</li>
      <li>Category certificate (if applicable)</li><li>Aadhaar card of the candidate and parent</li><li>Four passport-size photographs</li></ol>
      <p>Admission is provisional, subject to verification of documents and a medical check.</p>
      <div style="display:flex;justify-content:space-between;margin-top:46px"><div>Parent's acceptance<br><br>________________</div><div style="text-align:right">Principal / Director<br>${INSTITUTE}</div></div>
    </div></div>`
}
