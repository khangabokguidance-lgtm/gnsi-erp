// Builds the printable Mission Sainik 2027 Institute Notice (notice + Annexures I–V) as an HTML string.
// Text follows the Principal's notice GNSI/MS-2027/PMT/2026/01. Clause 10 (use of the portal) is an addition.
import { TESTS, MOCK_TESTS } from '../missionSainikData.js'

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const d = iso => new Date(iso + 'T00:00:00')
const fmt = iso => d(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
const fmtS = iso => d(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const fmtY = iso => d(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
const day = iso => d(iso).toLocaleDateString('en-GB', { weekday: 'long' })
const dayS = iso => d(iso).toLocaleDateString('en-GB', { weekday: 'short' })

// Annexure-II as printed in the notice (one setter per subject; practice verifier + assistants).
export const NOTICE_PANEL = [
  ['Mathematics', 'Sir Sumanta', 'Q1 – Q25', 'Sir Sunder, Sir Kabiraj, Sir Bronson', '25 + 25 + 25'],
  ['Reasoning', 'Sir Johny', 'Q26 – Q50', 'Sir Umesh', '25 + 25'],
  ['Science', 'Sir Arunkumar', 'Q51 – Q75', 'Sir Basanta', '25 + 25'],
  ['General Knowledge', 'Sir Deepak', 'Q76 – Q100', 'Sir Chetan', '25 + 25'],
  ['English Grammar', 'Sir Manglemba', 'Q101 – Q125', 'Sir Bidyachandra, Sir Adision', '25 + 25 + 25'],
  ['Vocabulary', 'Sir Pawan', 'Q126 – Q150', 'Miss Fedrava', '25 + 25'],
]
// Annexure-III column order in the notice
const SYL_COLS = ['Mathematics', 'Reasoning', 'English Grammar', 'General Knowledge', 'Science', 'Vocabulary']

export function buildNoticeHtml({ orderNo, orderDate, deadline, examDate = '2027-01-31', syl = {}, institute = {}, marks = [] }) {
  const t0 = TESTS[0].date, t20 = TESTS[TESTS.length - 1].date
  const m0 = MOCK_TESTS[0].date, m20 = MOCK_TESTS[MOCK_TESTS.length - 1].date
  const sched = TESTS.map(t => `<tr><td><b>${t.id}</b></td><td>${esc(fmtY(t.date))}</td><td>${esc(day(t.date))}</td><td>${esc(fmtS(t.drafts))}</td><td>${esc(fmtS(t.verify))}</td><td>${esc(fmtS(t.print))}</td></tr>`).join('')
  const panel = NOTICE_PANEL.map(p => `<tr><td>${esc(p[0])}</td><td>${esc(p[1])}</td><td>50</td><td>${esc(p[2])}</td></tr>`).join('')
  const prac = NOTICE_PANEL.map(p => `<tr><td>${esc(p[0])}</td><td>${esc(p[1])}</td><td>${esc(p[3])}</td><td>${esc(p[4])}</td></tr>`).join('')
  const synRows = TESTS.map(t => `<tr><td>T${t.no}</td><td>${esc(dayS(t.date))} ${esc(fmtS(t.date))}</td>${SYL_COLS.map(c => `<td>${esc(syl[t.no + '|' + c] || '')}</td>`).join('')}</tr>`).join('')
  const mockRows = MOCK_TESTS.map(t => `<tr><td>T${t.no}</td><td>${esc(dayS(t.date))} ${esc(fmt(t.date))}</td><td></td><td></td><td></td><td></td></tr>`).join('')
  const markRows = TESTS.map(t => {
    const es = marks.filter(r => r.test_no === t.no)
    const avg = k => (es.filter(r => r[k] != null).length ? (es.reduce((a, r) => a + (Number(r[k]) || 0), 0) / es.filter(r => r[k] != null).length).toFixed(1) : '')
    const tot = es.length ? (es.reduce((a, r) => a + ['maths', 'reasoning', 'grammar', 'gk'].reduce((x, k) => x + (Number(r[k]) || 0), 0), 0) / es.length).toFixed(1) : ''
    return `<tr><td>T${t.no}</td><td>${esc(dayS(t.date))} ${esc(fmtS(t.date))}</td><td>${avg('maths')}</td><td>${avg('reasoning')}</td><td>${avg('grammar')}</td><td>${avg('gk')}</td><td>${tot}</td></tr>`
  }).join('')
  const name = institute.name || 'GUIDANCE NAVODAYA & SAINIK INSTITUTE (GNSI)'
  return `<!doctype html><html><head><meta charset="utf-8"><title>Notice – Mission Sainik 2027</title>
<style>@page{size:A4;margin:14mm}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:'Times New Roman',serif;color:#111827;font-size:12.5px;line-height:1.45}
.lh{text-align:center;border-bottom:3px double #132a4f;padding-bottom:8px}.lh h1{margin:0;font-size:21px;color:#132a4f;letter-spacing:.5px}.lh div{font-size:11.5px}
.ref{display:flex;justify-content:space-between;font-weight:bold;margin:10px 0}h2{text-align:center;text-decoration:underline;letter-spacing:3px;color:#132a4f;margin:8px 0 4px}
h3{text-align:center;color:#132a4f;margin:0 0 4px}.sub{text-align:center;font-weight:bold;margin-bottom:10px}ol{padding-left:20px}li{margin-bottom:5px;text-align:justify}
ol.a{list-style:lower-alpha;margin:3px 0}table{width:100%;border-collapse:collapse;font-size:11.5px;margin:8px 0}th{background:#132a4f;color:#fff;text-align:left}
th,td{border:1px solid #7a8194;padding:3px 6px}.sig{margin-top:26px;text-align:right}.pb{page-break-before:always}.new{background:#fff8dc}.small{font-size:11px;color:#444}.cc{font-size:11.5px;margin-top:14px}</style></head><body>
<div class="lh"><h1>${esc(name)}</h1><div>Residential Coaching Institute for JNVST, AISSEE (Sainik School) and RMS</div><div>${esc(institute.address || 'Khangabok, Thoubal, Manipur')} · Established 2016</div><div><b>OFFICE OF THE PRINCIPAL</b></div></div>
<div class="ref"><span>No. ${esc(orderNo)}</span><span>Date: ${esc(fmt(orderDate))}</span></div>
<h2>NOTICE</h2><div class="sub">Subject: Schedule of 20 Pre Mock Tests and submission of study material by Question Setters.</div>
<p>It is hereby notified for the information of all concerned that:</p>
<ol>
<li>The Institute shall conduct twenty (20) Pre Mock Tests, designated PMT-01 to PMT-20, under “Mission Sainik 2027” on alternate days from ${esc(fmt(t0))} to ${esc(fmt(t20))}, in the latest pattern of the AISSEE.</li>
<li>Each test shall have 150 multiple-choice questions carrying 300 marks, in six sections of 25 questions each at 2 marks per question: Mathematics, Reasoning, Science, General Knowledge, English Grammar and Vocabulary. The schedule is at Annexure-I and the Question Setting Panel at Annexure-II.</li>
<li>All study material, namely the question sections of all twenty tests and the practice question bank, shall be submitted at the office of the Head of the Institute <b>on or before ${esc(fmt(deadline))}</b>.</li>
<li>Every question setter shall:<ol class="a"><li>submit Word files named Subject_SetterName_PMT-XX.docx;</li><li>give four options (A to D), the correct answer, a one-line explanation, the topic and the difficulty level for every question, in a mix of about 40% easy, 40% medium and 20% hard; and</li><li>follow the latest AISSEE pattern and syllabus only.</li></ol></li>
<li>Every teacher on the Panel shall set questions and shall verify the questions before submission.</li>
<li>No test or deadline shall fall on 13 December 2026, 27 December 2026 or 1 January 2027.</li>
<li>The tests begin immediately after the JNVST (26 to 29 November 2026).</li>
<li>The duration of the test, OMR format, the setters and submission date of the Daily Class Test papers, and the dates of the Sainik Mock Test Series shall be notified separately. All questions shall remain confidential until the test is held.</li>
<li>Any deviation shall require the prior written approval of the Principal. This Notice takes effect immediately.</li>
<li class="new"><b>Use of the GNSI Portal.</b> Progress of this Notice shall be recorded in the GNSI Portal under Management → Mission Sainik. Each setter shall upload questions in the Pre Mock Builder (Mega Mock, Daily Test and Practice Bank builders for the respective papers) in the prescribed format and mark the task submitted; a Panel member other than the setter shall mark the section verified; the Principal shall approve. Question papers and answer keys shall be printed only from the portal, and the portal record (including its audit log) shall be the official record of submission. Questions shall not be shared outside the Panel or through any other channel.</li>
</ol>
<table><thead><tr><th colspan="2">Important Dates</th></tr></thead><tbody>
<tr><td>Last date of submission of all study material at the Head of the Institute's office</td><td>${esc(fmt(deadline))} (${esc(day(deadline))})</td></tr>
<tr><td>First Pre Mock Test PMT-01 and Daily Class Test T1</td><td>${esc(fmt(t0))} (${esc(day(t0))})</td></tr>
<tr><td>Last Pre Mock Test PMT-20 and Daily Class Test T20</td><td>${esc(fmt(t20))} (${esc(day(t20))})</td></tr>
<tr><td>AISSEE 2027 (Class VI) examination</td><td>${esc(fmt(examDate))} (${esc(day(examDate))})</td></tr></tbody></table>
<div class="sig"><b>(Moirangthem Himan Singh)</b><br>Founder &amp; Principal<br>Guidance Navodaya &amp; Sainik Institute</div>
<div class="cc"><b>Copy to:</b> 1. Vice Principal, GNSI · Exam Cell · All Question Setters (Mathematics, Reasoning, Science, General Knowledge, English Grammar, Vocabulary) &nbsp; 2. Notice Board &nbsp; 3. Office File</div>

<div class="pb"><h3>ANNEXURE-I</h3><div class="sub">Schedule of Pre Mock Tests and Deadlines</div>
<table><thead><tr><th>Test</th><th>Date</th><th>Day</th><th>Drafts due</th><th>Verification</th><th>Final &amp; print</th></tr></thead><tbody>${sched}</tbody></table>
<div class="small">Note: PMT-04 and PMT-11 fall on Sundays, which are working days. The test of 1 January 2027 (New Year's Day) is moved to 2 January 2027.</div></div>

<div class="pb"><h3>ANNEXURE-II</h3><div class="sub">Question Setting Panel</div>
<table><thead><tr><th>Subject</th><th>Question setter</th><th>Marks per test</th><th>Question No.</th></tr></thead><tbody>${panel}</tbody></table>
<div class="sub" style="margin-top:14px">Practice Question Setting Panel</div>
<table><thead><tr><th>Subject</th><th>Practice question verifier</th><th>Assistant</th><th>Questions to be prepared per chapter</th></tr></thead><tbody>${prac}</tbody></table>
<div class="small">Please follow the latest syllabus pattern. Don't submit without preparation and creativity.</div></div>

<div class="pb"><h3>ANNEXURE-III</h3><div class="sub">Pre Mock Test Schedule with Syllabus (${esc(fmt(t0))} – ${esc(fmt(t20))})</div>
<table><thead><tr><th>Test</th><th>Date</th>${SYL_COLS.map(c => `<th>${esc(c)} (25 Q)</th>`).join('')}</tr></thead><tbody>${synRows}</tbody></table>
<div class="sub" style="margin-top:14px">Mock Test Schedule (${esc(fmt(m0))} – ${esc(fmt(m20))})</div>
<table><thead><tr><th>Test</th><th>Date</th><th>Mathematics (50 Q)</th><th>Intelligence (25 Q)</th><th>Grammar + Vocabulary (25 Q)</th><th>Science + GK (25 Q)</th></tr></thead><tbody>${mockRows}</tbody></table></div>

<div class="pb"><h3>ANNEXURE-IV</h3><div class="sub">AISSEE Class VI: Examination at a Glance and Preparation Phases</div>
<p>The AISSEE Class VI paper tests four subjects in a single 150-minute sitting. Marks are not deducted for wrong answers.</p>
<table><thead><tr><th>Subject</th><th>Questions</th><th>Marks each</th><th>Total marks</th></tr></thead><tbody>
<tr><td>Mathematics</td><td>50</td><td>3</td><td>150</td></tr><tr><td>Intelligence</td><td>25</td><td>2</td><td>50</td></tr><tr><td>Language</td><td>25</td><td>2</td><td>50</td></tr><tr><td>General Knowledge</td><td>25</td><td>2</td><td>50</td></tr><tr><td><b>Total</b></td><td><b>125</b></td><td></td><td><b>300</b></td></tr></tbody></table>
<p><b>Duration and mode:</b> 150 minutes, pen-and-paper (OMR) test. <b>Medium:</b> English, Hindi and 11 regional languages. <b>Qualifying marks:</b> a minimum of 25% in each subject and 40% overall is needed to qualify (reserved categories: no subject minimum). <b>Marking:</b> no negative marking.</p>
<p class="small">Source: the AISSEE pattern recorded in the GNSI Portal (officialSyllabus.js). Confirm the details against the official NTA information bulletin before the exam.</p>
<table><thead><tr><th>Phase</th><th>Dates</th><th>What happens</th></tr></thead><tbody>
<tr><td>Sainik Pre Mock Test Series</td><td>${esc(fmtS(t0))} – ${esc(fmt(t20))}</td><td>20 tests with one gap day between tests. The Daily Class Test on each date covers one chapter in every subject (Annexure-III).</td></tr>
<tr><td>Sainik Mock Test Series</td><td>${esc(fmtS(m0))} – ${esc(fmt(m20))}</td><td>20 tests, one every available day.</td></tr>
<tr><td>Examination</td><td>${esc(fmt(examDate))}</td><td>AISSEE 2027, Class VI.</td></tr></tbody></table></div>

<div class="pb"><h3>ANNEXURE-V</h3><div class="sub">Marks Tracker and Error Log</div>
<p>Enter each student's or batch's score for every Daily Class Test. Mathematics has 20 questions (3 marks each, 60 marks); Reasoning, English Grammar and General Knowledge have 10 questions each (2 marks each, 20 marks); 120 marks in all. Revisit any chapter scoring below 60%.${marks.length ? ' Figures shown are class averages from the portal.' : ''}</p>
<table><thead><tr><th>Test</th><th>Date</th><th>Maths /60</th><th>Reasoning /20</th><th>Grammar /20</th><th>GK /20</th><th>Total /120</th></tr></thead><tbody>${markRows}</tbody></table></div>
<script>window.onload=function(){window.print()}</script></body></html>`
}
