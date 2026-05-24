// ─────────────────────────────────────────────────────────────────────────────
// GNSI Portal — admitCardTemplate.js
// Shared NTA-style admit card: CSS + HTML generator + print window opener
// Import in Exams.jsx:
//   import { ADMIT_CARD_CSS, generateAdmitCardHTML, openAdmitCardPrintWindow } from './admitCardTemplate';
// ─────────────────────────────────────────────────────────────────────────────

export const ADMIT_CARD_CSS = `
@import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,500&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:wght@300;400;500;600;700&display=swap');

html, *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  --navy:    #0A1931;
  --navy2:   #122346;
  --blue:    #1B4F8A;
  --blue2:   #2563A8;
  --blue3:   #3B82C4;
  --red:     #B91C1C;
  --red2:    #DC2626;
  --gold:    #92691A;
  --gold2:   #B8860B;
  --gold3:   #D4A017;
  --green:   #166534;
  --cream:   #FEFCF8;
  --cream2:  #F5EFE0;
  --border:  #C5CAD8;
  --border2: #8896AE;
  --text:    #0D1117;
  --text2:   #2D3748;
  --text3:   #4A5568;
}

@page {
  size: 210mm 297mm;
  margin: 0;
}

body {
  font-family: 'Source Sans 3', sans-serif;
  font-size: 14px;
  background: #D6D3CE;
  color: var(--text);
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
  margin: 0;
  padding: 0;
}

.no-print {
  display: flex;
  gap: 10px;
  justify-content: center;
  align-items: center;
  padding: 12px 20px;
  background: #1e293b;
  border-bottom: 3px solid var(--gold2);
  position: sticky;
  top: 0;
  z-index: 100;
}
.no-print button {
  padding: 9px 24px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  font-family: 'Source Sans 3', sans-serif;
  letter-spacing: 0.3px;
}
.btn-print { background: var(--blue); color: white; }
.btn-print:hover { background: var(--blue2); }
.btn-close  { background: #475569; color: white; }

.admit-card {
  width: 210mm;
  min-height: 297mm;
  margin: 12mm auto;
  background: var(--cream);
  position: relative;
  display: flex;
  flex-direction: column;
  box-shadow: 0 8px 40px rgba(0,0,0,0.25);
  overflow: hidden;
}

.tricolor-top {
  height: 7px;
  background: linear-gradient(to right,
    #FF9933 0%, #FF9933 33.3%,
    #FFFFFF 33.3%, #FFFFFF 66.6%,
    #138808 66.6%, #138808 100%
  );
  flex-shrink: 0;
}

.card-header {
  background: linear-gradient(160deg, var(--navy) 0%, var(--navy2) 50%, #0E1E3D 100%);
  padding: 14px 20px 12px;
  display: flex;
  align-items: center;
  gap: 16px;
  border-bottom: 3px solid var(--gold2);
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}
.card-header::before {
  content: '';
  position: absolute;
  inset: 0;
  background-image: repeating-linear-gradient(
    -45deg,
    rgba(255,255,255,0.012) 0px,
    rgba(255,255,255,0.012) 1px,
    transparent 1px,
    transparent 10px
  );
  pointer-events: none;
}

.logo-ring {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 2.5px solid var(--gold2);
  background: rgba(255,255,255,0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 0 0 4px rgba(184,134,11,0.15), inset 0 0 16px rgba(0,0,0,0.3);
  position: relative;
  z-index: 1;
}
.logo-initials {
  font-family: 'Libre Baskerville', serif;
  font-size: 17px;
  font-weight: 700;
  color: var(--gold3);
  letter-spacing: 1px;
}

.header-center {
  flex: 1;
  text-align: center;
  position: relative;
  z-index: 1;
}
.header-eyebrow {
  font-size: 8.5px;
  letter-spacing: 4px;
  text-transform: uppercase;
  color: rgba(212,160,23,0.80);
  margin-bottom: 4px;
}
.header-inst-name {
  font-family: 'EB Garamond', serif;
  font-size: 26px;
  font-weight: 600;
  color: #FFFFFF;
  line-height: 1.15;
  margin-bottom: 3px;
  letter-spacing: 0.3px;
}
.header-inst-addr {
  font-size: 12px;
  color: rgba(255,255,255,0.68);
  margin-bottom: 3px;
  letter-spacing: 0.3px;
}
.header-tagline {
  font-family: 'EB Garamond', serif;
  font-style: italic;
  font-size: 12.5px;
  color: var(--gold3);
  opacity: 0.9;
}

.admit-badge {
  background: var(--red);
  border: 2px solid rgba(255,255,255,0.25);
  border-radius: 3px;
  padding: 10px 16px;
  text-align: center;
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  box-shadow: 0 2px 8px rgba(0,0,0,0.4);
}
.admit-badge-word {
  font-family: 'Libre Baskerville', serif;
  font-size: 17px;
  font-weight: 700;
  color: #FFFFFF;
  letter-spacing: 4px;
  line-height: 1.3;
  display: block;
}

.gold-rule {
  background: var(--cream2);
  border-bottom: 1px solid #DDD5BE;
  padding: 6px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
.gold-rule-line { flex: 1; height: 1px; background: linear-gradient(90deg, transparent, var(--gold2), transparent); }
.gold-rule-diamond { font-size: 9px; color: var(--gold2); }

.exam-banner {
  background: var(--blue);
  padding: 7px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.exam-banner-name {
  font-family: 'EB Garamond', serif;
  font-size: 17px;
  font-weight: 600;
  color: #FFFFFF;
  letter-spacing: 0.5px;
}
.exam-banner-year {
  font-size: 12px;
  color: rgba(255,255,255,0.85);
  background: rgba(255,255,255,0.15);
  padding: 2px 12px;
  border-radius: 2px;
  letter-spacing: 0.5px;
}

.notice-bar {
  background: #FFFBEB;
  border-top: 1px solid #F6C23E;
  border-bottom: 1px solid #F6C23E;
  padding: 5px 20px;
  font-size: 11px;
  font-weight: 600;
  color: #78350F;
  text-align: center;
  letter-spacing: 0.3px;
  flex-shrink: 0;
}

.section-block {
  padding: 10px 20px 0;
}
.section-head {
  font-family: 'Libre Baskerville', serif;
  font-size: 10px;
  font-weight: 700;
  color: var(--blue);
  text-transform: uppercase;
  letter-spacing: 2.5px;
  padding-bottom: 4px;
  border-bottom: 2px solid var(--blue);
  margin-bottom: 0;
}

.cand-table-wrap {
  display: flex;
  gap: 0;
  border: 1.5px solid var(--border2);
  margin-top: 8px;
}
.cand-table {
  flex: 1;
  border-collapse: collapse;
  font-size: 13px;
}
.cand-table td {
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
}
.cand-table .lbl {
  font-size: 10px;
  font-weight: 700;
  color: var(--text3);
  text-transform: uppercase;
  letter-spacing: 0.8px;
  background: #F7F9FC;
  width: 28%;
  white-space: nowrap;
  border-right: 1px solid var(--border);
}
.cand-table .val {
  font-family: 'EB Garamond', serif;
  font-size: 15px;
  font-weight: 500;
  color: var(--text);
}
.cand-table .val.big {
  font-size: 19px;
  font-weight: 700;
  color: var(--navy);
  letter-spacing: 2px;
}
.cand-table .val.name {
  font-size: 17px;
  font-weight: 700;
  color: var(--navy);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.cand-table .val.highlight {
  font-weight: 700;
  color: var(--blue);
  font-size: 14px;
}

.photo-col {
  width: 96px;
  border-left: 1.5px solid var(--border2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px 8px;
  background: #F7F9FC;
  gap: 5px;
  flex-shrink: 0;
}
.photo-box {
  width: 76px;
  height: 90px;
  border: 1.5px dashed var(--border2);
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  font-size: 9.5px;
  color: var(--text3);
  text-align: center;
  line-height: 1.6;
  overflow: hidden;
}
.photo-box img { width: 100%; height: 100%; object-fit: cover; }
.photo-label {
  font-size: 8.5px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--text3);
  font-weight: 600;
}

.sched-table {
  width: 100%;
  border-collapse: collapse;
  border: 1.5px solid var(--border2);
  margin-top: 8px;
  font-size: 12.5px;
}
.sched-table thead tr { background: var(--navy); }
.sched-table thead th {
  padding: 7px 12px;
  color: white;
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  text-align: left;
  border-right: 1px solid rgba(255,255,255,0.15);
}
.sched-table thead th:last-child { border-right: none; }
.sched-table tbody tr { background: white; }
.sched-table tbody tr:nth-child(even) { background: #F5F8FC; }
.sched-table tbody td {
  padding: 6px 12px;
  border-bottom: 1px solid var(--border);
  border-right: 1px solid var(--border);
  font-size: 12.5px;
  color: var(--text2);
}
.sched-table tbody td:last-child { border-right: none; }
.sched-table tbody td:first-child { font-weight: 700; color: var(--navy); }
.sched-table tbody td.subject-cell { font-weight: 600; color: var(--text); }
.sched-table tbody td.center { text-align: center; }

.instr-wrap {
  border: 1.5px solid var(--border2);
  border-left: 5px solid var(--red);
  margin-top: 8px;
  overflow: hidden;
}
.instr-head {
  background: #FEF2F2;
  border-bottom: 1px solid #FCA5A5;
  padding: 5px 14px;
  font-size: 10px;
  font-weight: 700;
  color: var(--red);
  text-transform: uppercase;
  letter-spacing: 1px;
}
.instr-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  font-size: 11px;
  color: var(--text2);
}
.instr-item {
  padding: 5px 14px;
  border-bottom: 1px solid var(--border);
  line-height: 1.45;
}
.instr-item:nth-child(odd) { border-right: 1px solid var(--border); }
.instr-item:nth-last-child(-n+2) { border-bottom: none; }

.sig-section {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
  padding: 12px 20px 14px;
  border-top: 2px solid var(--border2);
  margin-top: auto;
  background: white;
  flex-shrink: 0;
}
.sig-block { flex: 1; text-align: center; }
.sig-space {
  height: 38px;
  border-bottom: 1.5px solid var(--text2);
  margin: 0 8px 4px;
}
.sig-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 1.5px;
  color: var(--text3);
  font-weight: 700;
}
.sig-sub {
  font-size: 10.5px;
  color: var(--blue);
  font-weight: 600;
  margin-top: 2px;
}
.seal-block {
  flex: 0 0 78px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
}
.seal {
  width: 74px;
  height: 74px;
  border-radius: 50%;
  border: 2px dashed var(--gold2);
  background: var(--cream2);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
}
.seal-word {
  font-size: 7.5px;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: var(--gold);
  font-weight: 700;
}
.seal-star { font-size: 16px; color: var(--gold2); line-height: 1; }

.barcode-row {
  background: var(--cream2);
  border-top: 1px solid #DDD5BE;
  border-bottom: 1px solid #DDD5BE;
  padding: 5px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}
.barcode-label { font-size: 10px; color: var(--text3); }
.barcode-number {
  font-family: 'Libre Baskerville', serif;
  font-size: 12px;
  font-weight: 700;
  color: var(--navy);
  letter-spacing: 3px;
}

.bottom-bar {
  background: linear-gradient(90deg, var(--navy) 0%, var(--navy2) 50%, var(--navy) 100%);
  padding: 7px 20px;
  position: relative;
  flex-shrink: 0;
}
.bottom-bar::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 2px;
  background: linear-gradient(90deg, var(--gold), var(--gold3), var(--gold));
}
.bottom-bar-text {
  font-size: 9.5px;
  color: rgba(255,255,255,0.6);
  text-align: center;
  letter-spacing: 0.5px;
}

.tricolor-bottom {
  height: 5px;
  background: linear-gradient(to right,
    #FF9933 0%, #FF9933 33.3%,
    #FFFFFF 33.3%, #FFFFFF 66.6%,
    #138808 66.6%, #138808 100%
  );
  flex-shrink: 0;
}

.page-break { page-break-after: always; height: 0; display: block; }

@media print {
  body { background: white; }
  .no-print { display: none !important; }
  .admit-card {
    width: 100%;
    min-height: 100vh;
    margin: 0;
    box-shadow: none;
    border-radius: 0;
    page-break-after: always;
    break-after: page;
  }
  .admit-card:last-child {
    page-break-after: avoid;
    break-after: avoid;
  }
}
`;

// ─── HTML GENERATOR ───────────────────────────────────────────────────────────
export function generateAdmitCardHTML(st, {
  examTypeName,
  examSchedule,
  institute,
  course,
}) {
  const gcc = String(st.gcc_no || "").padStart(6, "0");
  const hallTicket = `GNSI-${gcc}-${examTypeName.replace(/\s+/g, "").toUpperCase().slice(0, 7)}`;

  const scheduleRows = examSchedule.length
    ? examSchedule
        .slice()
        .sort((a, b) => a.exam_date.localeCompare(b.exam_date))
        .map(
          (s) => `
        <tr>
          <td>${s.exam_date}</td>
          <td>${s.time || "—"}</td>
          <td class="subject-cell">${s.subject}</td>
          <td class="center">${s.total_marks}</td>
          <td class="center" style="color:#94A3B8">—</td>
        </tr>`
        )
        .join("")
    : `<tr><td colspan="5" style="text-align:center;padding:12px;color:#94A3B8;font-style:italic;font-size:12px">No schedule entries added yet.</td></tr>`;

  return `
<div class="admit-card">
  <div class="tricolor-top"></div>

  <div class="card-header">
    <div class="logo-ring">
      ${
        institute.logoUrl
          ? `<img src="${institute.logoUrl}" style="width:100%;height:100%;object-fit:contain;border-radius:50%"/>`
          : `<div class="logo-initials">GNSI</div>`
      }
    </div>
    <div class="header-center">
      <div class="header-eyebrow">Completing 10 Years of Journey · Established in 2016</div>
      <div class="header-inst-name">${institute.name || "Guidance Navodaya &amp; Sainik Institute"}</div>
      <div class="header-inst-addr">${institute.address || "Khangabok Sorok Wangma,Thoubal, Manipur -795138"}</div>
      <div class="header-tagline">${institute.tagline || "A Premier Institute for Navodaya,Sainik & RMS Preparation since 2016"}</div>
    </div>
    <div class="admit-badge">
      <span class="admit-badge-word">ADMIT</span>
      <span class="admit-badge-word">CARD</span>
    </div>
  </div>

  <div class="gold-rule">
    <div class="gold-rule-line"></div>
    <div class="gold-rule-diamond">◆</div>
    <div class="gold-rule-line"></div>
  </div>

  <div class="exam-banner">
    <div class="exam-banner-name">✦ &nbsp;${examTypeName}</div>
    <div class="exam-banner-year">Academic Year ${institute.academicYear || "2026-2027"}</div>
  </div>

  <div class="notice-bar">
    ⚠&nbsp;&nbsp;This Admit Card must be produced at the Examination Hall. Without this card, entry will not be permitted.
  </div>

  <div class="section-block" style="padding-top:12px">
    <div class="section-head">Candidate Information</div>
    <div class="cand-table-wrap">
      <table class="cand-table">
        <tr>
          <td class="lbl">Candidate Name</td>
          <td class="val name" colspan="3">${st.name}</td>
        </tr>
        <tr>
          <td class="lbl">Roll / GCC Number</td>
          <td class="val big">${gcc}</td>
          <td class="lbl">Admission No.</td>
          <td class="val">${st.admission_no || "—"}</td>
        </tr>
        <tr>
          <td class="lbl">Course</td>
          <td class="val">${st.course || course}</td>
          <td class="lbl">Batch</td>
          <td class="val">${st.class_name || course}</td>
        </tr>
        <tr>
          <td class="lbl">Institute</td>
          <td class="val" colspan="3">${institute.name || "Guidance Navodaya &amp; Sainik Institute"}, ${institute.address || "Khangabok, Manipur"}</td>
        </tr>
        <tr>
          <td class="lbl">Academic Year</td>
          <td class="val">${institute.academicYear || "2026-2027"}</td>
          <td class="lbl">Examination</td>
          <td class="val highlight">${examTypeName}</td>
        </tr>
      </table>
      <div class="photo-col">
        <div class="photo-box">
          ${
            st.photo_url
              ? `<img src="${st.photo_url}"/>`
              : "Affix<br/>Passport<br/>Size<br/>Photo"
          }
        </div>
        <div class="photo-label">Photograph</div>
      </div>
    </div>
  </div>

  <div class="section-block" style="padding-top:12px">
    <div class="section-head">Examination Schedule</div>
    <table class="sched-table">
      <thead>
        <tr>
          <th style="width:18%">Date</th>
          <th style="width:12%">Time</th>
          <th>Subject / Paper</th>
          <th style="width:13%;text-align:center">Max Marks</th>
          <th style="width:18%;text-align:center">Examination Hall</th>
        </tr>
      </thead>
      <tbody>${scheduleRows}</tbody>
    </table>
  </div>

  <div class="section-block" style="padding-top:12px;padding-bottom:12px">
    <div class="section-head">Important Instructions to Candidates</div>
    <div class="instr-wrap">
      <div class="instr-head">⚠&nbsp; Read carefully before appearing for examination</div>
      <div class="instr-grid">
        <div class="instr-item">① This Admit Card must be carried to the examination hall.</div>
        <div class="instr-item">② Report at the hall at least 15 minutes before start time.</div>
        <div class="instr-item">③ Mobile phones and electronic devices are strictly banned.</div>
        <div class="instr-item">④ This card must be surrendered on demand by the invigilator.</div>
        <div class="instr-item">⑤ Candidates without this card will not be permitted entry.</div>
        <div class="instr-item">⑥ Any malpractice will result in immediate disqualification.</div>
      </div>
    </div>
  </div>

  <div class="sig-section">
    <div class="sig-block">
      <div class="sig-space"></div>
      <div class="sig-label">Candidate's Signature</div>
    </div>
    <div class="seal-block">
      <div class="seal">
        <div class="seal-word">Official</div>
        <div class="seal-star">★</div>
        <div class="seal-word">Seal</div>
      </div>
    </div>
    <div class="sig-block">
      <div class="sig-space"></div>
      <div class="sig-label">Exam Coordinator</div>
    </div>
    <div class="sig-block">
      <div class="sig-space"></div>
      <div class="sig-label">Head of Institute</div>
    </div>
  </div>

  <div class="barcode-row">
    <div class="barcode-label">Hall Ticket No.</div>
    <div class="barcode-number">${hallTicket}</div>
    <div class="barcode-label">Issued: ${new Date().toLocaleDateString("en-IN")}</div>
  </div>

  <div class="bottom-bar">
    <div class="bottom-bar-text">
      ${institute.name || "GNSI"} &nbsp;·&nbsp; ${institute.address || "Khangabok, Manipur"} &nbsp;·&nbsp; ${examTypeName} &nbsp;·&nbsp; ${institute.academicYear || "2025-2026"} &nbsp;·&nbsp; For queries contact the Institute Office
    </div>
  </div>
  <div class="tricolor-bottom"></div>
</div>`;
}

// ─── PRINT WINDOW OPENER ──────────────────────────────────────────────────────
export function openAdmitCardPrintWindow(cards, title) {
  const w = window.open("", "_blank");
  if (!w) {
    alert(
      "⚠️ Popup blocked!\n\nPlease allow popups for this site:\n• Chrome: click the blocked popup icon in the address bar\n• Firefox: click 'Options' in the popup blocked bar\n• Safari: Settings → Websites → Pop-up Windows → Allow"
    );
    return null;
  }

  const count = Array.isArray(cards) ? cards.length : 1;
  const joined = Array.isArray(cards)
    ? cards.join('<div class="page-break"></div>')
    : cards;

  w.document.write(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link href="https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Libre+Baskerville:ital,wght@0,400;0,700;1,400&family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
  <style>${ADMIT_CARD_CSS}</style>
</head>
<body>
  <div class="no-print">
    <button class="btn-print" id="printBtn" onclick="
      const btn = document.getElementById('printBtn');
      btn.textContent = '⏳ Loading fonts…';
      btn.disabled = true;
      document.fonts.ready.then(() => {
        setTimeout(() => {
          window.print();
          btn.textContent = '🖨️ Print / Save as PDF';
          btn.disabled = false;
        }, 600);
      });
    ">🖨️ Print / Save as PDF</button>
    <button class="btn-close" onclick="window.close()">✕ Close</button>
    <span style="color:rgba(255,255,255,0.5);font-size:12px;margin-left:8px">${count} card${count !== 1 ? "s" : ""}</span>
  </div>
  ${joined}
</body>
</html>`);
  w.document.close();
  return w;
}