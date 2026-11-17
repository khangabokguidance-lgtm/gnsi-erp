// MissionSainikGuide.jsx — "How to use" tab: an illustrated, step-by-step guide to every tab of the Mission Sainik module.
// Graphics are small inline SVG schematics (generated as strings so the same art is used on screen and in the printed guide).
import { useState } from 'react'
import { PremiumCard, PX } from './premiumUI'

const N = '#132a4f', G = '#C9A24B', OK = '#15803d', WN = '#b45309', BD = '#b91c1c', T = '#eef1f6', L = '#cfd6e4', BL = '#1d4ed8'
const r = (x, y, w, h, f = T, rx = 3, s = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}" ${s}/>`
const tx = (x, y, t, sz = 7, f = N, w = 600, a = 'start') => `<text x="${x}" y="${y}" font-size="${sz}" fill="${f}" font-weight="${w}" text-anchor="${a}" font-family="system-ui,sans-serif">${t}</text>`
const ln = (x1, y1, x2, y2, c = L, w = 1) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="${w}"/>`
const frame = inner => `<svg viewBox="0 0 160 96" xmlns="http://www.w3.org/2000/svg" role="img">${r(0, 0, 160, 96, '#fff', 8, `stroke="${L}"`)}${r(0, 0, 160, 12, N, 8)}${r(0, 6, 160, 6, N, 0)}${r(6, 4, 4, 4, G, 2)}${r(13, 4, 4, 4, '#6b7a99', 2)}${inner}</svg>`
const tiles = (y = 18, n = 4) => Array.from({ length: n }, (_, i) => r(8 + i * (144 / n), y, 144 / n - 5, 18, T, 4) + r(11 + i * (144 / n), y + 4, 12, 4, N, 2) + r(11 + i * (144 / n), y + 11, 20, 3, G, 1.5)).join('')
const chip = (x, y, c, w = 16) => r(x, y, w, 6, c, 3)
const rows = (y0, n, step = 11, cols = [8, 40, 80]) => Array.from({ length: n }, (_, i) => ln(8, y0 + i * step, 152, y0 + i * step) + cols.map((c, j) => r(c, y0 + 3 + i * step, j === 0 ? 24 : 26, 4, '#b8c2d6', 2)).join('')).join('')

// One schematic per tab
const ART = {
  guide: frame(`${tx(10, 26, 'How to use', 9)}${r(10, 32, 140, 6, T)}${r(10, 42, 110, 6, T)}${r(10, 52, 125, 6, T)}${r(10, 66, 40, 16, G, 4)}${tx(30, 77, 'Start', 7, '#fff', 700, 'middle')}`),
  overview: frame(`${tiles()}${r(8, 42, 90, 46, '#fff', 4, `stroke="${L}"`)}${[0, 1, 2, 3, 4, 5].map(i => r(14, 48 + i * 6.5, 28, 4, T, 2) + r(14, 48 + i * 6.5, 10 + (i * 11) % 24, 4, i % 2 ? G : OK, 2)).join('')}${r(104, 42, 48, 46, N, 6)}${tx(128, 62, '76d', 14, '#fff', 800, 'middle')}${tx(128, 74, 'AISSEE', 6, G, 700, 'middle')}`),
  schedule: frame(`${r(8, 18, 144, 8, N, 2)}${rows(28, 5)}${chip(112, 31, OK)}${chip(112, 42, OK)}${chip(112, 53, WN)}${chip(112, 64, T)}${chip(112, 75, T)}`),
  mock: frame(`${tx(10, 24, 'JANUARY 2027', 6, N, 700)}${Array.from({ length: 21 }, (_, i) => r(10 + (i % 7) * 20, 28 + Math.floor(i / 7) * 20, 17, 16, i === 0 ? G : i < 7 ? '#dbe3f3' : T, 3)).join('')}${tx(146, 24, '31 Jan', 6, BD, 700, 'end')}`),
  allotment: frame(`${r(8, 18, 144, 7, N, 2)}${Array.from({ length: 4 }, (_, i) => Array.from({ length: 6 }, (_, j) => r(8 + j * 24, 28 + i * 15, 22, 12, T, 3) + r(11 + j * 24, 31 + i * 15, 12, 3, '#6b7a99', 1.5) + chip(11 + j * 24, 36 + i * 15, [OK, WN, T][(i + j) % 3], 12)).join('')).join('')}`),
  mine: frame(`${[0, 1, 2, 3].map(i => r(8, 18 + i * 17, 144, 14, '#fff', 4, `stroke="${L}"`) + r(12, 22 + i * 17, 50, 4, N, 2) + r(12, 28 + i * 17, 34, 3, '#9aa5b8', 1.5) + chip(100, 21 + i * 17, [WN, BL, OK, BD][i], 20) + r(126, 20 + i * 17, 22, 9, i % 2 ? T : G, 4)).join('')}`),
  practice: frame(`${[0, 1, 2].map(i => r(8, 18 + i * 24, 70, 20, T, 4) + tx(14, 30 + i * 24, ['Maths', 'Reasoning', 'Science'][i], 7) + r(84, 18 + i * 24, 68, 20, '#fff', 4, `stroke="${L}"`) + tx(90, 31 + i * 24, ['25 + 25 + 25', '25 + 25', '25 + 25'][i], 7, WN, 700)).join('')}`),
  syllabus: frame(`${r(8, 18, 144, 7, N, 2)}${Array.from({ length: 5 }, (_, i) => Array.from({ length: 6 }, (_, j) => r(8 + j * 24, 28 + i * 12, 22, 9, i === 1 && j === 2 ? '#fff6dc' : T, 2, i === 1 && j === 2 ? `stroke="${G}"` : '')).join('')).join('')}${tx(14, 92, 'type a chapter, click away to save', 5, '#6b7a99', 500)}`),
  marks: frame(`${r(8, 18, 144, 7, N, 2)}${[0, 1, 2, 3, 4].map(i => ln(8, 28 + i * 12, 152, 28 + i * 12) + [0, 1, 2, 3, 4].map(j => tx(14 + j * 28, 38 + i * 12, [46, 15, 12, 18, 91][(i + j) % 5], 7, (i + j) % 4 === 0 ? BD : N, (i + j) % 4 === 0 ? 800 : 500)).join('')).join('')}`),
  material: frame(`${r(8, 18, 144, 30, T, 5)}${r(12, 22, 136, 5, '#fff', 2)}${r(12, 30, 136, 10, '#fff', 2)}${r(12, 42, 36, 4, G, 2)}${[0, 1].map(i => r(8, 54 + i * 17, 144, 14, '#fff', 4, `stroke="${L}"`) + tx(14, 64 + i * 17, ['📝 Notes (typed)', '📎 File.pdf'][i], 7) + r(118, 57 + i * 17, 28, 8, N, 4)).join('')}`),
  prebuilder: frame(`${Array.from({ length: 6 }, (_, i) => r(8 + (i % 3) * 48, 18 + Math.floor(i / 3) * 24, 44, 20, i === 5 ? T : '#e6f4ea', 4) + tx(14 + (i % 3) * 48, 31 + Math.floor(i / 3) * 24, i === 5 ? '12/25' : '25/25', 9, i === 5 ? WN : OK, 800)).join('')}${r(8, 68, 92, 20, G, 5)}${tx(54, 81, '🖨 Paper + 🔑 Key', 7, '#fff', 700, 'middle')}${r(106, 68, 46, 20, OK, 5)}${tx(129, 81, 'Ready', 8, '#fff', 700, 'middle')}`),
  activity: frame(`${[0, 1, 2, 3, 4].map(i => tx(10, 28 + i * 14, ['Sumanta', 'Johny', 'Deepak', 'Pawan', 'Arun'][i], 7) + r(52, 22 + i * 14, 70, 7, T, 3) + r(52, 22 + i * 14, [60, 45, 30, 55, 20][i], 7, i === 4 ? BD : OK, 3) + tx(150, 28 + i * 14, ['today', '1d', '3d', '0d', '5d'][i], 6, i > 1 && i !== 3 ? BD : OK, 700, 'end')).join('')}`),
  insights: frame(`${tiles(18, 4)}<polyline points="10,84 36,70 62,74 88,58 114,62 146,46" fill="none" stroke="${N}" stroke-width="2"/>${ln(8, 66, 152, 66, BD, 0.7)}${tx(150, 64, '60%', 5, BD, 700, 'end')}`),
  analyzer: frame(`${tx(10, 26, 'Rank list', 7)}${[0, 1, 2, 3].map(i => r(10, 30 + i * 12, 88, 9, T, 3) + r(10, 30 + i * 12, [80, 66, 52, 40][i], 9, [G, '#d8b765', '#b8c2d6', '#cfd6e4'][i], 3)).join('')}<circle cx="128" cy="52" r="22" fill="${T}"/><path d="M128 52 L128 30 A22 22 0 0 1 148 60 Z" fill="${N}"/><path d="M128 52 L148 60 A22 22 0 0 1 112 70 Z" fill="${G}"/>`),
  panel: frame(`${[0, 1, 2, 3].map(i => `<circle cx="22" cy="${28 + i * 17}" r="6" fill="${[N, G, OK, BL][i]}"/>${tx(34, 31 + i * 17, ['Maths  ·  Sumanta', 'Reasoning  ·  Johny', 'Science  ·  Arunkumar', 'GK  ·  Deepak'][i], 7)}${r(110, 24 + i * 17, 40, 8, T, 4)}`).join('')}`),
  admin: frame(`${[0, 1, 2].map(i => tx(10, 28 + i * 14, ['Deadline', 'Order no.', 'Embargo'][i], 7) + r(60, 21 + i * 14, 60, 9, T, 3, `stroke="${L}"`)).join('')}${r(128, 47, 22, 10, OK, 5)}<circle cx="144" cy="52" r="4" fill="#fff"/>${r(8, 70, 60, 16, N, 4)}${tx(38, 81, 'Setup check', 6, '#fff', 700, 'middle')}${r(74, 70, 78, 16, '#fff', 4, `stroke="${L}"`)}${tx(80, 81, 'Audit log', 6)}`),
}

const FLOW = [['1', 'Allotment', 'Admin creates tasks'], ['2', 'Set', 'Setter writes questions'], ['3', 'Upload', 'Paste or hand in file'], ['4', 'Verify', 'Another member checks'], ['5', 'Approve', 'Principal OKs, print'], ['6', 'Test day', 'Pre / Mega Mock held'], ['7', 'Analyse', 'Marks show weak areas']]
const flowSvg = (w = 640) => {
  const bw = 82, gap = (w - FLOW.length * bw) / (FLOW.length - 1)
  const parts = FLOW.map((f, i) => {
    const x = i * (bw + gap)
    return `${r(x, 6, bw, 52, i === 4 ? G : N, 10)}${tx(x + bw / 2, 24, f[0], 12, i === 4 ? N : G, 800, 'middle')}${tx(x + bw / 2, 39, f[1], 9, '#fff', 700, 'middle')}${i < FLOW.length - 1 ? `<path d="M${x + bw + 2} 32 l${gap - 4} 0" stroke="${G}" stroke-width="2" marker-end="url(#a)"/>` : ''}${tx(x + bw / 2, 78, f[2], 5.6, '#4b5870', 500, 'middle')}`
  }).join('')
  return `<svg viewBox="0 0 ${w} 88" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mission Sainik workflow"><defs><marker id="a" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0 0 L6 3 L0 6 Z" fill="${G}"/></marker></defs>${parts}</svg>`
}

// id (matches the tab id) · title · art key · who · what · steps · tip
const GUIDE = [
  ['overview', 'Overview', 'overview', 'Everyone · admin creates the allotment', 'The dashboard: deadline, progress by subject, next test, days left to submission and AISSEE.', ['Check the header tiles for what is due next.', 'Admin: press “Create allotment” once to load all 133 tasks.', 'Use the subject bars to see which subject is behind.'], 'Overdue means a section is still Pending after its due date.'],
  ['schedule', 'Schedule', 'schedule', 'Everyone', 'The 20 Pre Mock Tests with drafts due, verification and print dates.', ['Find your test row.', 'Check “Drafts due” and “Final & print”.', 'Green = approved, amber = in progress.'], 'Sundays are working days; 13 Dec, 27 Dec and 1 Jan have no test.'],
  ['mock', 'Mock series', 'mock', 'Everyone', 'The Sainik Mega Mock series, 10–30 Jan 2027, in the AISSEE pattern.', ['See each test’s date and “in N days”.', 'Pattern: 125 questions, 300 marks, 150 minutes.'], 'No negative marking.'],
  ['allotment', 'Allotment', 'allotment', 'Everyone · admin reassigns', 'Who sets each section of each test.', ['Tap a cell to open that task.', 'Change setter or verifier if someone is absent.', 'Admin → Admin tab can make one teacher setter for a whole subject.'], 'Nobody should verify their own questions.'],
  ['mine', 'My tasks / All tasks', 'mine', 'Setters and verifiers', 'Your to-do list with status chips and one-click next step.', ['Open a task to see chapter, due date, status.', 'Enter question count and the Easy / Medium / Hard mix.', 'Press “Mark submitted” (setter) or “Mark verified” (verifier).'], 'Aim for about 40% easy, 40% medium, 20% hard.'],
  ['practice', 'Practice bank', 'practice', 'Practice panel', 'The practice question sets per subject.', ['Open a set and update its status like a task.', 'Maths and Grammar have 3 sets, the others 2 (25 questions each).'], 'Practice material is due with the rest on 28 Nov.'],
  ['syllabus', 'Syllabus', 'syllabus', 'Everyone', 'The chapter for each subject of each test.', ['Click a cell and type the chapter.', 'Click away — it saves automatically.', 'Setters see the chapter on their task.'], 'Weak chapters in Insights come from this grid.'],
  ['marks', 'Marks tracker', 'marks', 'Teachers', 'Daily Class Test marks: Maths /60, Reasoning, Grammar, GK /20 each (120).', ['Choose test and batch / student.', 'Enter the four section marks and Save.', 'Red = below 60%: revisit that chapter.'], 'Same test + batch again overwrites the entry.'],
  ['material', 'Study material', 'material', 'Everyone', 'Type, upload or link study material; typed material prints on A4.', ['Give a title, subject and test.', 'Type text, choose a file, or paste a link.', 'Press “Add material”; use Open or 🖨 Print in the library.'], 'Do not paste unreleased test questions here.'],
  ['prebuilder', 'Pre Mock Builder', 'prebuilder', 'Setters upload · everyone views', '150 questions per test, assembled automatically as setters upload.', ['Pick the test, then your section (Q1–25 Maths … Q126–150 Vocabulary).', 'Paste questions: Q, options A–D, Ans, Exp, Topic, Level — or load a .txt file.', 'A different panel member presses “✓ Mark verified”.', 'Print “Question paper” and “Answer key”.'], 'Only the section setter or an admin can upload; others view and print.'],
  ['megabuilder', 'Mega Mock Builder', 'prebuilder', 'Panel members', 'Mega Mock paper: Maths Q1–50, Intelligence Q51–75, Grammar+Vocabulary Q76–100, Science+GK Q101–125.', ['Same steps as the Pre Mock Builder.'], 'Printed papers say NOT FULLY VERIFIED until every section is signed off.'],
  ['dailybuilder', 'Daily Test Builder', 'prebuilder', 'Practice panel', 'Daily Class Tests T1–T20: Maths 20 Q, Reasoning 10, Grammar 10, GK 10.', ['Same steps; serials Q1–20, 21–30, 31–40, 41–50.'], '120 marks per daily test.'],
  ['practicebuilder', 'Practice Bank Builder', 'prebuilder', 'Practice panel', 'Practice sets of 25 questions per subject.', ['Pick the set and subject, paste, upload.', 'Deleted by mistake? Use the Recycle bin card.'], 'Export bank (⬇) makes a CSV backup.'],
  ['activity', 'Teacher activity', 'activity', 'Principal / in-charge', 'Per-teacher progress, uploads and days idle.', ['Sort shows overdue and idle teachers first.', 'Read the recent-activity feed for what changed today.'], 'Idle turns red after 3 days.'],
  ['insights', 'Insights', 'insights', 'Principal / in-charge', 'Delivery forecast, quality check, trend, weak chapters, leaderboard.', ['Check “Pace needed” against the deadline.', 'Press “Remind on WhatsApp” beside a late teacher.', 'Read weak chapters to plan revision.'], 'The reminder opens WhatsApp — you choose the recipient.'],
  ['premock', 'Pre Mock / Mega Mock Analyzer', 'analyzer', 'Teachers', 'Full analyzer shared with the Exams module: upload results, then student, subject and batch analysis.', ['Upload the Excel result sheet.', 'Open Student, Subject, Batch or Groups views.', 'Print the A4 reports.'], 'Use one spelling per student name.'],
  ['panel', 'Panel', 'panel', 'Everyone', 'The Question Setting Panel and verifiers.', ['See who sets and who verifies each subject.'], 'Changes are made in Allotment or the Admin tab.'],
  ['admin', 'Admin', 'admin', 'Admins only', 'Launch settings, embargo, one-click setter, setup check, audit log.', ['Set deadline, order number, exam date.', 'Switch the embargo on to hide questions until test day.', 'Run “Setup check” after migrations.', 'Read the audit log to see who did what.'], 'Audit entries cannot be edited or deleted.'],
]

const ROLES = [
  ['Question setter', ['My tasks → open your task', 'Builder → paste questions', 'Mark submitted']],
  ['Verifier', ['Builder → open the section', 'Check each question', '✓ Mark verified']],
  ['Principal / in-charge', ['Overview + Insights', 'Teacher activity', 'Approve and print']],
  ['Admin', ['Admin tab settings', 'Setup check', 'Audit log']],
]

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

export default function MissionSainikGuide({ onGo, isMobile, isAdmin, institute }) {
  const [open, setOpen] = useState('')
  const list = GUIDE.filter(g => g[0] !== 'admin' || isAdmin)
  const print = () => {
    const w = window.open('', '_blank'); if (!w) return
    const card = g => `<div class="c"><div class="a">${ART[g[2]]}</div><div class="t"><h3>${esc(g[1])}</h3><div class="w">${esc(g[3])}</div><p>${esc(g[4])}</p><ol>${g[5].map(x => `<li>${esc(x)}</li>`).join('')}</ol><div class="tip">Tip: ${esc(g[6])}</div></div></div>`
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Mission Sainik — How to use</title><style>@page{size:A4;margin:12mm}body{font-family:Georgia,serif;color:#111827;font-size:11.5px}
h1{margin:0;color:${N};text-align:center;font-size:20px}.s{text-align:center;color:#555;margin:2px 0 10px}.f{margin:8px 0 12px}.c{display:flex;gap:12px;border:1px solid ${L};border-radius:10px;padding:8px;margin-bottom:8px;page-break-inside:avoid}
.a{width:190px;flex:none}.a svg{width:100%}h3{margin:0 0 2px;color:${N};font-size:14px}.w{color:${WN};font-weight:700;font-size:10.5px}p{margin:3px 0}ol{margin:3px 0 3px 16px;padding:0}.tip{color:#555;font-style:italic}</style></head><body>
<h1>${esc(institute?.name || 'Guidance Navodaya & Sainik Institute')}</h1><div class="s">Mission Sainik 2027 · How to use the portal module</div><div class="f">${flowSvg()}</div>${list.map(card).join('')}<script>window.onload=()=>window.print()</script></body></html>`)
    w.document.close()
  }
  return (
    <>
      <PremiumCard title="How Mission Sainik works" subtitle="From allotment to analysis — follow the gold step to print." right={<button className="px-hbtn" onClick={print}>🖨 Print this guide</button>}>
        {isMobile
          ? <ol style={{ listStyle: 'none', margin: 0, padding: '12px 16px', display: 'grid', gap: 8 }}>{FLOW.map((f, i) => (
              <li key={f[0]} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', borderRadius: 14, background: i === 4 ? PX.goldBg : PX.tint, border: `1px solid ${i === 4 ? PX.goldLine : PX.line}` }}>
                <b style={{ width: 28, height: 28, borderRadius: '50%', background: i === 4 ? PX.gold : PX.navy, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: 'none', fontSize: 13 }}>{f[0]}</b>
                <span style={{ minWidth: 0 }}><b style={{ display: 'block', color: PX.navy, fontSize: 14.5 }}>{f[1]}</b><span style={{ fontSize: 12.5, color: PX.sub }}>{f[2]}</span></span>
              </li>))}</ol>
          : <div style={{ overflowX: 'auto' }}><div style={{ minWidth: 560 }} dangerouslySetInnerHTML={{ __html: flowSvg() }} /></div>}
      </PremiumCard>
      <PremiumCard title="Quick start by role">
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 10 }}>
          {ROLES.map(([role, steps]) => (
            <div key={role} style={{ padding: 12, borderRadius: 12, background: PX.tint }}>
              <div style={{ fontWeight: 800, color: PX.navy, marginBottom: 6, fontSize: 14 }}>{role}</div>
              {steps.map((st, i) => <div key={i} style={{ fontSize: 12.5, padding: '3px 0' }}><b style={{ color: PX.gold }}>{i + 1}.</b> {st}</div>)}
            </div>
          ))}
        </div>
      </PremiumCard>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 12 }}>
        {list.map(g => (
          <PremiumCard key={g[0]} title={g[1]} subtitle={g[3]} style={{ marginBottom: 0 }}>
            <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 10 }} aria-hidden="true" dangerouslySetInnerHTML={{ __html: ART[g[2]] }} />
            <div style={{ fontSize: 13.5, marginBottom: 6 }}>{g[4]}</div>
            <button className="px-hbtn" aria-expanded={open === g[0]} onClick={() => setOpen(open === g[0] ? '' : g[0])}>{open === g[0] ? 'Hide steps' : 'Show steps'}</button>
            {open === g[0] && (
              <div style={{ marginTop: 8 }}>
                <ol style={{ margin: '0 0 8px 18px', padding: 0, fontSize: 13, lineHeight: 1.6 }}>{g[5].map((x, i) => <li key={i}>{x}</li>)}</ol>
                <div style={{ fontSize: 12.5, color: PX.sub, fontStyle: 'italic' }}>Tip: {g[6]}</div>
              </div>
            )}
            {onGo && g[0] !== 'guide' && <div style={{ marginTop: 10 }}><button className="px-btn gold" onClick={() => onGo(g[0])}>Open {g[1]}</button></div>}
          </PremiumCard>
        ))}
      </div>
    </>
  )
}
