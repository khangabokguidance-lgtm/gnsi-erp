// MissionSainikSyllabusRef.jsx — reference pages inside Mission Sainik → Syllabus:
//   • "Official syllabus" — AISSEE (Sainik School) exam pattern and chapter list for Class 6 and Class 9
//   • "Manual"            — how the syllabus plan is built and used day to day
// The data comes from officialSyllabus.js (single source of truth, shared with Teaching → Syllabus).
import { useMemo, useState } from 'react'
import { PremiumCard, PX } from './premiumUI'
import { EXAM_PATTERNS, classesOf, officialSubjects, patternTotals } from './officialSyllabus'

const NTA_URL = 'https://exams.nta.nic.in/sainik-school-society/'
const TONES = ['#2563eb', '#7c3aed', '#16a34a', '#d97706', '#db2777', '#0891b2']

export function OfficialSyllabus({ isMobile }) {
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
        right={<a className="px-hbtn" href={NTA_URL} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>↗ NTA website</a>}>
        <div role="note" style={{ padding: '9px 12px', borderRadius: 12, background: PX.warnBg, color: PX.warn, fontSize: 12.5, lineHeight: 1.5, marginBottom: 12 }}>
          Last checked Sept 2026. Class 6 questions follow the Class 5 level and Class 9 follows NCERT Class 8. When NTA publishes the AISSEE 2027 Information Bulletin, compare its appendices (Class VI and Class IX syllabus) with this list.
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
  ['Keeping it right', ['Match chapter names to the Official syllabus page so teachers and the analyzers use one spelling.', 'When NTA releases the 2027 Information Bulletin, compare the plan with its Class VI and Class IX appendices and fix any differences.', 'A changed chapter shows on the setter’s task the next time they open or refresh it.']],
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
