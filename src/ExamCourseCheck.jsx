// ExamCourseCheck.jsx — "Course Check" tab (Exams → Setup).
// Lists every Combined Course student and every student whose course/batch in the
// Students module doesn't line up with where the Exams module puts them.
import { useMemo, useState } from 'react'
import { PX } from './premiumUI'
import { auditStudents, ISSUES } from './examCourseAudit'

const SEV = {
  error: { c: PX.bad, bg: PX.badBg, t: 'Fix needed' },
  warn:  { c: PX.warn, bg: PX.warnBg, t: 'Check' },
  info:  { c: PX.sub, bg: '#eef1f6', t: 'Note' },
}

export default function ExamCourseCheck({ students, courseSubjects, secondaryBatchMap }) {
  const { rows, summary } = useMemo(() => auditStudents(students, courseSubjects, secondaryBatchMap), [students, courseSubjects, secondaryBatchMap])
  const [filter, setFilter] = useState('problems')   // problems | combined | <issue id> | all
  const [q, setQ] = useState('')
  const [showDrop, setShowDrop] = useState(false)

  const visible = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return rows.filter(r => {
      if (!showDrop && /dropout/i.test(r.status)) return false
      if (filter === 'problems' && !r.issues.some(i => ISSUES[i].sev !== 'info')) return false
      if (filter === 'combined' && !r.isCombined) return false
      if (ISSUES[filter] && !r.issues.includes(filter)) return false
      if (needle && !`${r.name} ${r.gcc}`.toLowerCase().includes(needle)) return false
      return true
    })
  }, [rows, filter, q, showDrop])

  const exportCsv = () => {
    const head = ['Name', 'GCC/Adm no', 'Status', 'Students: course field', 'Students: batch field', 'Students module says', 'Exam module key', 'Combined?', 'Section', 'Issues']
    const lines = visible.map(r => [r.name, r.gcc, r.status, r.rawCourse, r.rawBatch, `${r.studentsCourse}${r.studentsBatch ? ' / ' + r.studentsBatch : ''}`, r.examKey, r.isCombined ? 'Yes' : '', r.section, r.issues.map(i => ISSUES[i].label).join('; ')])
    const csv = [head, ...lines].map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('﻿' + csv)
    a.download = `GNSI_course_check_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  const cards = [
    { id: 'combined', n: summary.combined, label: 'Combined students', sub: `${summary.combinedEng} ENG · ${summary.combinedMm} MM · ${summary.combinedNoSection} no section`, tone: PX.navy },
    { id: 'problems', n: summary.problems, label: 'Need attention', sub: summary.problems ? 'course / batch mismatches' : 'everything lines up', tone: summary.problems ? PX.bad : PX.ok },
    { id: 'blank_batch_in_combined', n: summary.byIssue.blank_batch_in_combined + summary.byIssue.no_course_no_batch, label: 'Wrongly in Combined', sub: 'blank batch → shown as Combined', tone: PX.warn },
    { id: 'batch_not_in_exam_setup', n: summary.byIssue.batch_not_in_exam_setup, label: 'Invisible in Exams', sub: 'batch not set up', tone: PX.bad },
  ]
  const filters = [
    ['problems', 'Needs attention'], ['combined', 'All Combined'], ['combined_wrong_batch', 'Combined + real batch'],
    ['blank_batch_in_combined', 'Blank batch'], ['no_course_no_batch', 'No course & batch'], ['course_batch_conflict', 'Course ≠ batch'],
    ['batch_not_in_exam_setup', 'Batch not in Exam setup'], ['combined_no_section', 'No ENG/MM'], ['all', 'Everyone'],
  ]

  return (
    <div className="cc">
      <style>{`
        .cc{display:flex;flex-direction:column;gap:16px;font-family:${PX.sans}}
        .cc-cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
        .cc-card{text-align:left;cursor:pointer;border:1px solid ${PX.line};border-radius:18px;background:linear-gradient(180deg,#fff,#fcfbf7);padding:16px 18px;font-family:${PX.sans};
          box-shadow:0 12px 30px -24px rgba(19,42,79,.45);transition:transform .14s,border-color .15s}
        .cc-card:hover{transform:translateY(-2px);border-color:${PX.gold}}
        .cc-card.on{border-color:${PX.navy};box-shadow:0 0 0 3px rgba(19,42,79,.1)}
        .cc-n{font:600 32px/1 ${PX.serif};font-variant-numeric:tabular-nums}
        .cc-chip{border:1px solid ${PX.line2};background:#fff;border-radius:99px;padding:7px 13px;font:600 12.5px ${PX.sans};color:${PX.ink2};cursor:pointer;white-space:nowrap}
        .cc-chip.on{background:linear-gradient(180deg,${PX.navy2},${PX.navy});color:#fff;border-color:${PX.navy}}
        .cc-wrap{background:#fff;border:1px solid ${PX.line};border-radius:18px;overflow:hidden;box-shadow:0 12px 30px -24px rgba(19,42,79,.4)}
        .cc table{width:100%;border-collapse:collapse;font-size:13px}
        .cc th{padding:11px 14px;text-align:left;font-size:10.5px;letter-spacing:.1em;text-transform:uppercase;color:${PX.sub};background:linear-gradient(180deg,#fcfaf3,#f3f0e8);border-bottom:1px solid ${PX.line};white-space:nowrap}
        .cc td{padding:11px 14px;border-bottom:1px solid #f1eee6;vertical-align:top;color:${PX.ink2}}
        .cc tr:hover td{background:#fcfaf3}
        .cc-pill{display:inline-block;padding:3px 9px;border-radius:99px;font:700 11px ${PX.sans};white-space:nowrap}
        @media (max-width:900px){.cc-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
      `}</style>

      <div className="cc-cards">
        {cards.map(c => (
          <button key={c.label} className={'cc-card' + (filter === c.id ? ' on' : '')} onClick={() => setFilter(c.id)}>
            <div className="cc-n" style={{ color: c.tone }}>{c.n}</div>
            <div style={{ fontWeight: 700, fontSize: 13.5, color: PX.ink, marginTop: 6 }}>{c.label}</div>
            <div style={{ fontSize: 11.5, color: PX.sub, marginTop: 2 }}>{c.sub}</div>
          </button>
        ))}
      </div>

      <div style={{ fontSize: 12.5, color: PX.sub, lineHeight: 1.6, background: PX.goldBg, border: `1px solid ${PX.goldLine}`, borderRadius: 14, padding: '11px 16px' }}>
        <b style={{ color: PX.navy }}>How to read this:</b> “Students module” is the course/batch saved on the student. “Exam module” is the batch key Exams uses to find papers and marks.
        A student with <b>no batch</b> is always listed as <b>Combined</b> in Exams — so a blank batch on a Sainik or Navodaya student puts them in the wrong exam list.
        Fix records in Students; this page only reports.
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {filters.map(([id, label]) => <button key={id} className={'cc-chip' + (filter === id ? ' on' : '')} onClick={() => setFilter(id)}>{label}{ISSUES[id] ? ` (${summary.byIssue[id]})` : ''}</button>)}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or GCC no…" style={{ flex: 1, minWidth: 200, height: 40, padding: '0 14px', border: `1px solid ${PX.line2}`, borderRadius: 11, font: `600 13.5px ${PX.sans}` }} />
        <label style={{ fontSize: 12.5, color: PX.sub, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={showDrop} onChange={e => setShowDrop(e.target.checked)} /> include dropouts</label>
        <button onClick={exportCsv} disabled={!visible.length} style={{ height: 40, padding: '0 16px', borderRadius: 11, border: `1px solid ${PX.line2}`, background: '#fff', font: `700 13px ${PX.sans}`, color: PX.ink2, cursor: 'pointer' }}>📥 Export {visible.length}</button>
      </div>

      <div className="cc-wrap">
        <div style={{ overflowX: 'auto' }}>
          <table>
            <thead><tr><th>Student</th><th>Students module</th><th>Exam module</th><th>What’s wrong</th></tr></thead>
            <tbody>
              {visible.slice(0, 300).map(r => (
                <tr key={r.id}>
                  <td><b style={{ color: PX.ink }}>{r.name}</b><div style={{ fontSize: 11.5, color: PX.faint }}>{r.gcc ? `GCC ${r.gcc}` : '—'}{/dropout/i.test(r.status) ? ' · dropout' : ''}</div></td>
                  <td>
                    <div>{r.studentsCourse}{r.studentsBatch ? ` · ${r.studentsBatch}` : ''}</div>
                    <div style={{ fontSize: 11, color: PX.faint }}>course field: {r.rawCourse || 'empty'} · batch: {r.rawBatch || 'empty'}</div>
                  </td>
                  <td>
                    <div>{r.examSaysCombined ? 'Combined Navodaya' : r.examKey || '—'}</div>
                    <div style={{ fontSize: 11, color: PX.faint }}>{r.isCombined ? `Combined${r.section ? ' · ' + r.section : ''}${r.dual ? ' · also in other batch' : ''}` : r.examTrack}</div>
                  </td>
                  <td>
                    {r.issues.length === 0 ? <span className="cc-pill" style={{ background: PX.okBg, color: PX.ok }}>Matches</span> : r.issues.map(i => (
                      <div key={i} style={{ marginBottom: 6 }}>
                        <span className="cc-pill" style={{ background: SEV[ISSUES[i].sev].bg, color: SEV[ISSUES[i].sev].c }}>{ISSUES[i].label}</span>
                        <div style={{ fontSize: 11.5, color: PX.sub, marginTop: 3, maxWidth: 420 }}>{ISSUES[i].fix}</div>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
              {!visible.length && <tr><td colSpan={4} style={{ padding: 36, textAlign: 'center', color: PX.sub }}>{filter === 'problems' ? '✅ No mismatches found — Students and Exams agree.' : 'No students match this filter.'}</td></tr>}
            </tbody>
          </table>
        </div>
        {visible.length > 300 && <div style={{ padding: '10px 16px', fontSize: 12, color: PX.sub }}>Showing the first 300 of {visible.length} — narrow the filter or use Export for the full list.</div>}
      </div>
    </div>
  )
}
