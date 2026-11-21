// MissionSainikSyllabusRef.jsx — reference pages inside Mission Sainik → Syllabus:
//   • "Official syllabus" — AISSEE (Sainik School) exam pattern and chapter list for Class 6 and Class 9
//   • "Manual"            — how the syllabus plan is built and used day to day
// The data comes from officialSyllabus.js (single source of truth, shared with Teaching → Syllabus).
import { useMemo, useState } from 'react'
import { PremiumCard, PX } from './premiumUI'
import { printPremium } from './lib/printPremium'
import { EXAM_PATTERNS, classesOf, officialSubjects, patternTotals } from './officialSyllabus'

const NTA_URL = 'https://exams.nta.nic.in/sainik-school-society/'
// From the NTA Information Bulletin AISSEE-2027 (dates and fee table, pages 2 and 15–16).
const KEY_DATES = [
  ['Exam', '31 Jan 2027 (Sunday)'], ['Class VI timing', '2:00 – 4:30 pm'], ['Class IX timing', '2:00 – 5:00 pm'],
  ['Apply online', '3 Nov – 2 Dec 2026'], ['Late fee ₹500', '3 – 6 Dec 2026'], ['Corrections', '7 – 9 Dec 2026'],
  ['City slip', '11 Jan 2027'], ['Admit card', '25 Jan 2027'], ['Fee', '₹850 · SC/ST ₹700'],
]
const TONES = ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#db2777', '#0891b2']

const esc = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
// Opens the premium A4 preview (letterhead, logo, footer) with a Print / Save as PDF button.
function printSyllabus(cls, pattern, subjects, institute) {
  const sec = n => pattern.sections.find(x => x.subject === n)
  const qs = pattern.sections.reduce((n, x) => n + x.questions, 0), marks = pattern.sections.reduce((n, x) => n + x.questions * x.marksEach, 0)
  const kpi = [[qs, 'Questions'], [marks, 'Marks'], [pattern.durationMin + ' min', 'Duration'], [pattern.negative ? 'Yes' : 'None', 'Negative marking']].map(([v, l]) => `<div class="kpi"><small>${l}</small><b>${v}</b></div>`).join('')
  const patt = `<table class="t"><thead><tr><th class="l">Section</th><th>Questions</th><th>Marks each</th><th>Total</th></tr></thead><tbody>${pattern.sections.map(s => `<tr><td class="l"><b>${esc(s.subject)}</b></td><td>${s.questions}</td><td>${s.marksEach}</td><td>${s.questions * s.marksEach}</td></tr>`).join('')}</tbody></table>`
  const blocks = subjects.map(([name, chs]) => { const s = sec(name); return `<h3>${esc(name)}${s ? ` <small>· ${s.questions} questions · ${s.questions * s.marksEach} marks</small>` : ''}</h3><ol style="columns:2;column-gap:22px;margin:4px 0 6px;padding-left:20px">${chs.map(c => `<li style="break-inside:avoid;margin:0 0 2px">${esc(c)}</li>`).join('')}</ol>` }).join('')
  printPremium(`<div class="title">AISSEE 2027 · Class ${cls} Syllabus</div><div class="sub">Sainik School entrance exam · exam 31 Jan 2027</div><div class="kpis">${kpi}</div>${patt}${blocks}<div class="foot">Source: NTA Information Bulletin AISSEE-2027, Appendix ${cls === 6 ? 'II' : 'III'}.</div>`,
    { title: `AISSEE-2027 Class ${cls} syllabus`, institute, docLabel: `AISSEE 2027 · Class ${cls} syllabus` })
}

export function OfficialSyllabus({ isMobile, institute }) {
  const classes = classesOf('sainik')
  const [cls, setCls] = useState(classes.includes(6) ? 6 : classes[0])
  const [q, setQ] = useState('')
  const pattern = EXAM_PATTERNS.sainik.classes[cls]
  const totals = pattern ? patternTotals(pattern) : null
  const subjects = useMemo(() => Object.entries(officialSubjects('sainik', cls)), [cls])
  const needle = q.trim().toLowerCase()
  const total = subjects.reduce((n, [, chs]) => n + chs.length, 0)
  const pill = on => ({ padding: '8px 16px', borderRadius: 99, border: `1.5px solid ${on ? PX.gold : PX.line}`, background: on ? PX.goldBg : '#fff', color: on ? PX.navy : PX.sub, fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'inherit' })
  return (
    <>
      <PremiumCard title="Official syllabus · AISSEE 2027" subtitle="Sainik School entrance exam (NTA): pattern, marks and every chapter by subject."
        right={<span style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="px-hbtn" onClick={() => pattern && printSyllabus(cls, pattern, subjects, institute || undefined)}>🖨 Print Class {cls} syllabus</button>
          <a className="px-hbtn" href="/syllabus/AISSEE-2027-Information-Bulletin.pdf" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>📄 Information Bulletin (PDF)</a>
          <a className="px-hbtn" href={NTA_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>↗ NTA website</a>
        </span>}>
        <div role="note" style={{ padding: '9px 12px', borderRadius: 12, background: PX.okBg, color: PX.ok, fontSize: 12.5, lineHeight: 1.5, marginBottom: 12 }}>
          Source: NTA Information Bulletin AISSEE-2027 — scheme of examination (para 4.4) and the topic lists in Appendix II (Class VI) and Appendix III (Class IX). Language-section questions are based on topics dealt with till Class V.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 8, marginBottom: 14 }}>
          {KEY_DATES.map(([l, v]) => (
            <div key={l} style={{ background: '#fff', border: `1px solid ${PX.line}`, borderRadius: 12, padding: '8px 10px' }}>
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase', color: PX.sub }}>{l}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: PX.navy, marginTop: 2 }}>{v}</div>
            </div>))}
        </div>
        <div role="tablist" aria-label="Class" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {classes.map(c => <button key={c} type="button" role="tab" aria-selected={c === cls} style={pill(c === cls)} onClick={() => setCls(c)}>Class {c}</button>)}
        </div>
        {pattern && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8, marginBottom: 12 }}>
              {[[totals.questions, 'Questions'], [totals.marks, 'Marks'], [pattern.durationMin + ' min', 'Duration'], [pattern.negative ? 'Yes' : 'None', 'Negative marking']].map(([v, l]) => (
                <div key={l} style={{ background: PX.tint, border: `1px solid ${PX.line}`, borderRadius: 14, padding: '10px 8px', textAlign: 'center' }}>
                  <div style={{ fontFamily: PX.serif, fontSize: 21, fontWeight: 700, color: PX.navy }}>{v}</div>
                  <div style={{ fontSize: 11, color: PX.sub, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase' }}>{l}</div>
                </div>))}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="px-table" style={{ minWidth: 0, width: '100%' }}>
                <thead><tr><th>Section</th><th>Questions</th><th>Marks each</th><th>Total</th></tr></thead>
                <tbody>
                  {pattern.sections.map(s => <tr key={s.subject}><td><b>{s.subject}</b></td><td>{s.questions}</td><td>{s.marksEach}</td><td>{s.questions * s.marksEach}</td></tr>)}
                </tbody>
              </table>
            </div>
            <ul style={{ margin: '10px 0 0', paddingLeft: 18, fontSize: 12.5, color: PX.sub, lineHeight: 1.6 }}>
              <li>{pattern.mode} · {pattern.medium}</li>
              {pattern.notes.map(n => <li key={n}>{n}</li>)}
            </ul>
          </>
        )}
      </PremiumCard>

      <PremiumCard title={`Class ${cls} chapters`} subtitle={`${total} chapters across ${subjects.length} subjects`}
        right={<input className="px-input" type="search" aria-label="Find a chapter" placeholder="Find a chapter…" value={q} onChange={e => setQ(e.target.value)} style={{ minWidth: isMobile ? 0 : 220, flex: '1 1 160px' }} />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,300px),1fr))', gap: 12 }}>
          {subjects.map(([subject, chapters], i) => {
            const list = needle ? chapters.filter(c => c.toLowerCase().includes(needle) || subject.toLowerCase().includes(needle)) : chapters
            if (!list.length) return null
            return (
              <section key={subject} style={{ border: `1px solid ${PX.line}`, borderLeft: `4px solid ${TONES[i % TONES.length]}`, borderRadius: 16, padding: '12px 14px', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}><b style={{ color: PX.navy }}>{subject}</b><span style={{ fontSize: 12, color: PX.sub }}>{list.length} chapter{list.length === 1 ? '' : 's'}</span></div>
                <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13.5, lineHeight: 1.7, color: PX.ink }}>{list.map(c => <li key={c}>{c}</li>)}</ol>
              </section>)
          })}
        </div>
        {needle && !subjects.some(([s, chs]) => chs.some(c => c.toLowerCase().includes(needle)) || s.toLowerCase().includes(needle)) && <div style={{ padding: 12, color: PX.sub, fontSize: 13 }}>No chapter matches “{q}”.</div>}
      </PremiumCard>
    </>
  )
}

const MANUAL = [
  ['What this tab is for', ['The Syllabus plan decides which chapter each section of each Pre Mock Test covers (20 tests × 6 sections).', 'Setters see the chapter on their task, so everyone sets questions on the same agreed topic.', 'The Official syllabus page is the reference for what AISSEE can ask; use it to choose chapters.']],
  ['Plan the chapters', ['Open Plan and find a test with “Add chapter…”.', 'Type a chapter or pick one of the suggestions (unused official chapters come first), then press Enter or click away. It saves by itself.', 'Use “Only tests with gaps” to see what is still empty and the Maths / Reasoning… chips for progress per subject.', 'Switch between Cards (easier on phones) and Grid (whole plan at once).']],
  ['Bulk import', ['Press Import and paste one line per chapter: test, subject, chapter — separated by a comma or a tab.', 'Subject can be Maths, Reasoning, Science, GK, Grammar or Vocab. Example: 1, Maths, Fractions.', 'Press Import chapters. Existing chapters for the same test and subject are replaced.', 'Press CSV to export the current plan.']],
  ['Setters and verifiers', ['Open your task: the chapter from this plan appears there.', 'Set questions on that chapter, at the level of the class you are preparing students for.', 'Verifiers check each question against the chapter before marking it verified.']],
  ['Keeping it right', ['Match chapter names to the Official syllabus page so teachers and the analyzers use one spelling.', 'The Official syllabus page copies Appendix II (Class VI) and III (Class IX) of the AISSEE-2027 bulletin; if NTA amends the bulletin on its website, update officialSyllabus.js to match.', 'A changed chapter shows on the setter’s task the next time they open or refresh it.']],
]

export function SyllabusManual() {
  return (
    <PremiumCard title="Syllabus manual" subtitle="How to plan, import and use the syllabus in Mission Sainik.">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', gap: 12 }}>
        {MANUAL.map(([title, steps], i) => (
          <section key={title} style={{ background: PX.tint, border: `1px solid ${PX.line}`, borderRadius: 16, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <b style={{ width: 26, height: 26, borderRadius: '50%', background: PX.navy, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, flex: 'none' }}>{i + 1}</b>
              <b style={{ color: PX.navy, fontSize: 15 }}>{title}</b>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13.5, lineHeight: 1.65, color: PX.ink }}>{steps.map(s => <li key={s}>{s}</li>)}</ul>
          </section>))}
      </div>
    </PremiumCard>
  )
}
