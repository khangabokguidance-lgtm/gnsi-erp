// ─────────────────────────────────────────────────────────────────────────────
// GNSI Portal — admitCardTemplate.js  (print-optimised)
// ─────────────────────────────────────────────────────────────────────────────

export const ADMIT_CARD_CSS = `
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  @page{margin:0.3cm;size:A4;}

  body{
    font-family:'EB Garamond','Palatino Linotype',Georgia,serif;
    background:#f0ece0;
    padding:20px;
    -webkit-print-color-adjust:exact;
    print-color-adjust:exact;
  }

  .no-print{
    text-align:center;margin-bottom:16px;
    display:flex;gap:10px;justify-content:center;
  }
  .no-print button{
    padding:10px 28px;border:none;border-radius:8px;
    cursor:pointer;font-family:inherit;font-size:14px;font-weight:600;
  }
  .btn-print{background:#1a3c2e;color:white;}
  .btn-close{background:#e5e7eb;color:#374151;}

  .page-break{page-break-after:always;height:0;overflow:hidden;}

  .admit-card{
    width:720px;margin:0 auto 28px;
    background:white;
    border:1.5px solid #1a2744;
    border-radius:4px;
    overflow:hidden;
    box-shadow:0 8px 32px rgba(0,0,0,0.18);
    font-family:'EB Garamond','Palatino Linotype',Georgia,serif;
  }

  .flag-strip{display:grid;grid-template-columns:1fr 1fr 1fr;height:6px;}
  .flag-strip .orange{background:#FF9933;}
  .flag-strip .white{background:#ffffff;border-top:1px solid #ccc;border-bottom:1px solid #ccc;}
  .flag-strip .green{background:#138808;}

  .header{
    background:linear-gradient(135deg,#0d1f3c 0%,#1a2d5a 60%,#1a3c2e 100%);
    padding:20px 28px;
    display:flex;align-items:center;gap:20px;
    position:relative;
  }

  .logo-circle{
    width:72px;height:72px;border-radius:50%;
    border:2.5px solid #c9a84c;
    background:rgba(255,255,255,0.08);
    display:flex;align-items:center;justify-content:center;
    flex-shrink:0;overflow:hidden;
  }
  .logo-circle img{width:100%;height:100%;object-fit:contain;border-radius:50%;}
  .logo-fallback{font-family:'Palatino Linotype',Georgia,serif;font-size:13px;font-weight:700;color:#c9a84c;text-align:center;line-height:1.2;}

  .header-text{flex:1;text-align:center;}
  .header-eyebrow{font-size:9px;letter-spacing:4px;text-transform:uppercase;color:rgba(201,168,76,0.85);margin-bottom:6px;font-family:'DM Sans',sans-serif;}
  .header-name{font-family:'Playfair Display',Georgia,serif;font-size:26px;font-weight:700;color:white;margin-bottom:3px;letter-spacing:.5px;}
  .header-addr{font-size:11.5px;color:rgba(255,255,255,0.75);margin-bottom:3px;}
  .header-tagline{font-size:12px;font-style:italic;color:rgba(201,168,76,0.9);}

  .admit-badge{background:#c0392b;border:2px solid #e74c3c;border-radius:6px;padding:10px 18px;text-align:center;flex-shrink:0;}
  .admit-badge-text{font-family:'Playfair Display',Georgia,serif;font-size:20px;font-weight:700;color:white;letter-spacing:3px;line-height:1.25;text-transform:uppercase;}

  .gold-divider{height:3px;background:linear-gradient(90deg,#c9a84c,#f0d080,#c9a84c);}

  .exam-bar{background:#1a3580;padding:10px 24px;display:flex;align-items:center;justify-content:space-between;}
  .exam-bar-title{font-family:'Playfair Display',Georgia,serif;font-size:17px;font-weight:700;color:white;display:flex;align-items:center;gap:8px;}
  .exam-bar-title::before{content:'✦';color:#c9a84c;font-size:13px;}
  .exam-bar-year{font-size:12px;font-weight:600;color:white;background:rgba(255,255,255,0.18);padding:4px 12px;border-radius:4px;letter-spacing:.5px;}

  .warning-strip{background:#fefae8;border-top:1px solid #e8d870;border-bottom:1px solid #e8d870;padding:9px 24px;font-size:12.5px;font-weight:600;color:#7a5c00;display:flex;align-items:center;gap:8px;}
  .warning-strip::before{content:'⚠';font-size:14px;}

  .body{padding:6px 14px 4px;}

  .section-label{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#1a2744;font-weight:700;font-family:'DM Sans',sans-serif;border-bottom:2px solid #1a2744;padding-bottom:4px;margin-bottom:12px;}

  .info-table{width:100%;border-collapse:collapse;margin-bottom:18px;}
  .info-table td{padding:9px 12px;border:1px solid #c8d0dc;font-size:13px;vertical-align:middle;}
  .info-table .lbl{font-size:9.5px;letter-spacing:2px;text-transform:uppercase;color:#4a5568;font-weight:700;background:#f7f9fc;width:180px;font-family:'DM Sans',sans-serif;}
  .info-table .val{font-weight:700;color:#0d1f3c;font-size:14px;}
  .info-table .val.big{font-size:18px;letter-spacing:3px;}

  .photo-box{border:1.5px dashed #8090b0;border-radius:4px;width:110px;height:130px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#f7f9fc;text-align:center;color:#8090b0;font-size:11px;line-height:1.5;font-family:'DM Sans',sans-serif;}

  .schedule-table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12.5px;}
  .schedule-table thead tr{background:#1a2744;}
  .schedule-table thead th{padding:8px 12px;color:white;font-weight:700;font-size:9.5px;letter-spacing:1.5px;text-transform:uppercase;font-family:'DM Sans',sans-serif;text-align:left;}
  .schedule-table tbody td{padding:8px 12px;border-bottom:1px solid #dde3ed;color:#1a2030;}
  .schedule-table tbody tr:nth-child(even){background:#f7f9fc;}

  .instructions{background:#f7f9fc;border:1px solid #dde3ed;border-left:4px solid #1a2744;border-radius:2px;padding:12px 16px;margin-bottom:16px;}
  .instructions-title{font-size:10px;letter-spacing:2.5px;text-transform:uppercase;color:#1a2744;font-weight:700;margin-bottom:8px;font-family:'DM Sans',sans-serif;}
  .instructions ol{padding-left:18px;}
  .instructions li{font-size:11.5px;color:#2d3748;margin-bottom:4px;line-height:1.5;}

  .sig-row{display:flex;justify-content:space-between;align-items:flex-end;padding:6px 16px 8px;border-top:1px solid #dde3ed;gap:12px;}
  .sig-block{text-align:center;flex:1;}
  .sig-space{height:24px;}
  .sig-line{border-top:1.5px solid #1a2030;padding-top:5px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#4a5568;font-weight:700;font-family:'DM Sans',sans-serif;margin:0 8px;}
  .seal-block{flex:0 0 80px;text-align:center;}
  .seal{width:70px;height:70px;border-radius:50%;border:2px dashed #c9a84c;background:white;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;margin:0 auto;}
  .seal-word{font-size:7px;letter-spacing:2px;text-transform:uppercase;color:#c9a84c;font-weight:700;font-family:'DM Sans',sans-serif;}
  .seal-star{font-size:16px;color:#c9a84c;line-height:1;}

  .ticket-bar{background:#f5f0e0;border-top:1px solid #c9a84c;padding:8px 24px;display:flex;align-items:center;justify-content:space-between;font-family:'DM Sans',sans-serif;}
  .ticket-label{font-size:11px;color:#6b6050;letter-spacing:1px;text-transform:uppercase;}
  .ticket-number{font-family:'Courier New',monospace;font-size:15px;font-weight:700;letter-spacing:4px;color:#0d1f3c;}
  .ticket-date{font-size:11px;color:#6b6050;}

  .footer-bar{background:#0d1f3c;padding:10px 20px;text-align:center;font-size:11px;color:rgba(255,255,255,0.8);line-height:1.6;font-family:'DM Sans',sans-serif;}

  @media print {
    body { background: white; padding: 0; }
    .no-print { display: none !important; }
    .admit-card { box-shadow: none; border-radius: 0; width: 100%; margin: 0; }

    .header {
      background: white !important;
      border-bottom: 2px solid #1a2744 !important;
      padding: 16px 24px !important;
    }
    .header-name    { color: #0d1f3c !important; }
    .header-addr    { color: #2d3748 !important; }
    .header-eyebrow { color: #7a6010 !important; }
    .header-tagline { color: #7a6010 !important; }

    .logo-circle {
      background: white !important;
      border-color: #1a2744 !important;
    }

    .admit-badge {
      background: white !important;
      border: 2.5px solid #c0392b !important;
      box-shadow: none !important;
    }
    .admit-badge-text { color: #c0392b !important; }

    .exam-bar {
      background: white !important;
      border-bottom: 1.5px solid #1a3580 !important;
    }
    .exam-bar-title { color: #1a3580 !important; }
    .exam-bar-title::before { color: #c9a84c !important; }
    .exam-bar-year {
      background: #1a3580 !important;
      color: white !important;
    }

    .footer-bar {
      background: white !important;
      color: #0d1f3c !important;
      border-top: 2px solid #0d1f3c !important;
    }
  }
`;

export function generateAdmitCardHTML(student, { examTypeName, examSchedule = [], institute, course }) {
  const scheduleRows = examSchedule
    .filter(s => !s.course || s.course.toUpperCase() === (course || "").toUpperCase())
    .sort((a, b) => a.exam_date > b.exam_date ? 1 : -1)
    .map((s, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${s.exam_date || "—"}</td>
        <td>${s.subject || "—"}</td>
        <td>${s.shift || "Morning"}</td>
        <td>${s.time || "—"}</td>
        <td>${s.room || "—"}</td>
        <td>${s.total_marks || "—"}</td>
      </tr>`)
    .join("");

  const ticketCode = `GNSI-${String(student.gcc_no || "").padStart(6, "0")}-${
    (examTypeName || "EXAM").replace(/\s+/g, "").toUpperCase().slice(0, 7)
  }`;

  const logoHTML = institute?.logoUrl
    ? `<img src="${institute.logoUrl}" alt="Logo" />`
    : `<div class="logo-fallback">GNSI</div>`;

  return `
  <div class="admit-card">
    <div class="flag-strip"><div class="orange"></div><div class="white"></div><div class="green"></div></div>

    <div class="header">
      <div class="logo-circle">${logoHTML}</div>
      <div class="header-text">
        <div class="header-eyebrow">Completing 10 Years of Journey &middot; Established in 2016</div>
        <div class="header-name">${institute?.name || "Guidance Navodaya &amp; Sainik Institute"}</div>
        <div class="header-addr">${institute?.address || "Khangabok Sorok Wangma, Thoubal, Manipur-795138"}</div>
        <div class="header-tagline">${institute?.tagline || "A Premier Institute for Navodaya &amp; Sainik Preparation since 2016"}</div>
      </div>
      <div class="admit-badge"><div class="admit-badge-text">ADMIT<br/>CARD</div></div>
    </div>
    <div class="gold-divider"></div>

    <div class="exam-bar">
      <div class="exam-bar-title">${examTypeName || "Examination"}</div>
      <div class="exam-bar-year">Academic Year ${institute?.academicYear || "2026-2027"}</div>
    </div>

    <div class="warning-strip">
      This Admit Card must be produced at the Examination Hall. Without this card, entry will not be permitted.
    </div>

    <div class="body">
      <div class="section-label">Candidate Information</div>
      <table class="info-table">
        <tr>
          <td class="lbl">Candidate Name</td>
          <td class="val big" colspan="3">${student.name || "—"}</td>
          <td rowspan="3" style="width:120px;padding:8px;text-align:center;border:1px solid #c8d0dc;">
            <div class="photo-box">Affix<br/>Passport<br/>Size<br/>Photo</div>
          </td>
        </tr>
        <tr>
          <td class="lbl">Roll / GCC Number</td>
          <td class="val big">${String(student.gcc_no || "").padStart(6, "0")}</td>
          <td class="lbl">Admission No.</td>
          <td class="val">${student.admission_no || "—"}</td>
        </tr>
        <tr>
          <td class="lbl">Course</td>
          <td class="val">${student.course || course || "—"}</td>
          <td class="lbl">Batch</td>
          <td class="val">${student.class_name || "—"}</td>
        </tr>
      </table>

      ${scheduleRows ? `
      <div class="section-label">Examination Schedule</div>
      <table class="schedule-table">
        <thead>
          <tr>
            <th>#</th><th>Date</th><th>Subject</th>
            <th>Shift</th><th>Time</th><th>Room/Hall</th><th>Max Marks</th>
          </tr>
        </thead>
        <tbody>${scheduleRows}</tbody>
      </table>` : ""}

      <div class="instructions">
        <div class="instructions-title">Important Instructions</div>
        <ol>
          <li>Candidates must bring this Admit Card to every examination session.</li>
          <li>Report to the examination hall at least <strong>15 minutes</strong> before the scheduled time.</li>
          <li>Mobile phones and electronic gadgets are strictly prohibited in the hall.</li>
          <li>Only permitted stationery (pen, pencil, eraser, sharpener) allowed.</li>
          <li>OMR sheets must be filled with blue/black ballpoint pen only.</li>
        </ol>
      </div>
    </div>

    <div class="sig-row">
      <div class="sig-block"><div class="sig-space"></div><div class="sig-line">Candidate's Signature</div></div>
      <div class="seal-block">
        <div class="seal">
          <div class="seal-word">Official</div>
          <div class="seal-star">★</div>
          <div class="seal-word">Seal</div>
        </div>
      </div>
      <div class="sig-block"><div class="sig-space"></div><div class="sig-line">Exam Coordinator</div></div>
      <div class="sig-block"><div class="sig-space"></div><div class="sig-line">Head of Institute</div></div>
    </div>

    <div class="ticket-bar">
      <span class="ticket-label">Hall Ticket No.</span>
      <span class="ticket-number">${ticketCode}</span>
      <span class="ticket-date">Issued: ${new Date().toLocaleDateString("en-IN")}</span>
    </div>

    <div class="footer-bar">
      ${institute?.name || "Guidance Navodaya &amp; Sainik Institute"} &middot;
      ${institute?.address || "Khangabok, Manipur"} &middot;
      ${examTypeName || "Examination"} &middot;
      ${institute?.academicYear || "2026-2027"} &middot;
      For queries contact the Institute Office
    </div>

    <div class="flag-strip"><div class="orange"></div><div class="white"></div><div class="green"></div></div>
  </div>`;
}

export function openAdmitCardPrintWindow(cardHTMLArray, title = "Admit Cards") {
  const w = window.open("", "_blank");
  if (!w) { alert("⚠️ Popup blocked! Please allow popups for this site."); return; }
  w.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=EB+Garamond:wght@400;500;600&family=DM+Sans:wght@400;600;700&display=swap" rel="stylesheet"/>
  <style>${ADMIT_CARD_CSS}</style>
</head>
<body>
  <div class="no-print">
    <button class="btn-print" onclick="document.fonts.ready.then(()=>{setTimeout(()=>window.print(),300)});">
      🖨️ Print / Save as PDF
    </button>
    <button class="btn-close" onclick="window.close()">✕ Close</button>
  </div>
  ${cardHTMLArray.join('<div class="page-break"></div>')}
</body>
</html>`);
  w.document.close();
}