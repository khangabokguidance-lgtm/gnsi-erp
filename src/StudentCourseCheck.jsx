// StudentCourseCheck.jsx — "Course Check" tab of the Students module.
// Finds Combined Course students and every student whose course/batch here does not
// match where the Exams module files them, and lets staff fix each one in place.
// Detection lives in examCourseAudit.js (shared with Exams → Setup → Course Check).
import { useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { COURSE_BATCHES, COURSE_ORDER } from './courseMap'
import { auditStudents, ISSUES, KEY_TRACK } from './examCourseAudit'
import { askConfirm, notify } from './examShared'

const V = { // theme-aware tokens (same CSS variables the Students module uses)
  surface: 'var(--surface)', surface2: 'var(--surface2)', border: 'var(--border)', border2: 'var(--border2)',
  t1: 'var(--text1)', t2: 'var(--text2)', t3: 'var(--text3)', t4: 'var(--text4)',
  navy: '#132a4f', navy2: '#1e3a6e', gold: '#b8923a', goldBg: '#f6efdc', goldLine: '#e9d9b0',
  red: '#DC2626', redBg: '#FEF2F2', amber: '#D97706', amberBg: '#FFFBEB', green: '#059669', greenBg: '#ECFDF5',
  serif: "'Fraunces',Georgia,serif",
}
const SEV = {
  error: { c: V.red, bg: V.redBg }, warn: { c: V.amber, bg: V.amberBg }, info: { c: V.t3, bg: V.surface2 },
}
const COMBINED = 'Combined Course'

function suggestFor(r) {
  if (r.issues.includes('combined_wrong_batch') || r.rawCourse === COMBINED) return { course: COMBINED, batch: '—' }
  if (r.issues.includes('course_batch_conflict') && r.examTrack) return { course: r.examTrack, batch: r.studentsBatch }
  if (r.issues.includes('blank_batch_in_combined')) return { course: r.studentsCourse !== 'Unassigned' ? r.studentsCourse : '', batch: '' }
  if (r.issues.includes('no_course_no_batch')) return { course: '', batch: '' }
  return { course: r.studentsCourse !== 'Unassigned' ? r.studentsCourse : '', batch: r.studentsBatch }
}

function FixEditor({ r, onApply, disabled }) {
  const sug = useMemo(() => suggestFor(r), [r])
  const [course, setCourse] = useState(sug.course)
  const [batch, setBatch] = useState(sug.batch)
  const [busy, setBusy] = useState(false)
  const isCombined = course === COMBINED
  const batches = COURSE_BATCHES[course] || []
  const sel = { height: 32, borderRadius: 9, border: `1px solid ${V.border2}`, background: V.surface, color: V.t1, fontSize: 12.5, fontFamily: 'inherit', padding: '0 8px' }
  const effBatch = isCombined ? '—' : batch
  const changed = course !== (r.rawCourse || '') || effBatch !== (r.rawBatch || '')
  const ok = course && (isCombined || effBatch) && changed

  const apply = async () => {
    const yes = await askConfirm(
      `${r.name}\nCourse: ${r.rawCourse || 'empty'} → ${course}\nBatch: ${r.rawBatch || 'empty'} → ${effBatch}`,
      { confirmLabel: 'Save change' })
    if (!yes) return
    setBusy(true)
    await onApply(r.id, { course, batch: effBatch })
    setBusy(false)
  }
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
      <select style={sel} value={course} onChange={e => { setCourse(e.target.value); setBatch('') }} aria-label="Course">
        <option value="">Course…</option>
        {COURSE_ORDER.map(c => <option key={c}>{c}</option>)}
      </select>
      <select style={{ ...sel, opacity: isCombined ? .55 : 1 }} value={isCombined ? '—' : batch} disabled={isCombined || !course} onChange={e => setBatch(e.target.value)} aria-label="Batch">
        <option value="">{isCombined ? '— (none for Combined)' : 'Batch…'}</option>
        {batches.filter(b => b !== 'Lakshya' || r.rawBatch === 'Lakshya').map(b => <option key={b}>{b}</option>)}
      </select>
      <button onClick={apply} disabled={!ok || busy || disabled}
        style={{ height: 32, padding: '0 14px', borderRadius: 9, border: 'none', cursor: ok && !busy && !disabled ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: 12.5, color: ok && !disabled ? '#fff' : V.t4, background: ok && !disabled ? `linear-gradient(180deg,${V.navy2},${V.navy})` : V.surface2 }}>
        {busy ? 'Saving…' : 'Fix'}
      </button>
    </div>
  )
}

export default function StudentCourseCheck({ students, onQuickSave, onBulkFix, can, isMobile }) {
  const [secondary, setSecondary] = useState({})
  const [filter, setFilter] = useState('problems')
  const [q, setQ] = useState('')
  const [showDrop, setShowDrop] = useState(false)

  useEffect(() => {
    let live = true
    supabase.from('student_secondary_batches').select('student_id, batch').then(({ data }) => {
      if (!live) return
      const m = {}
      ;(data || []).forEach(r => { (m[r.student_id] = m[r.student_id] || []).push(r.batch) })
      setSecondary(m)
    })
    return () => { live = false }
  }, [])

  const known = useMemo(() => Object.fromEntries(Object.keys(KEY_TRACK).map(k => [k, []])), [])
  const { rows, summary } = useMemo(() => auditStudents(students, known, secondary), [students, known, secondary])

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

  // Everyone who is clearly a Combined Course student but filed under the wrong course/batch.
  const fixable = useMemo(() => rows.filter(r => !/dropout/i.test(r.status) && (r.issues.includes('combined_wrong_batch') || r.issues.includes('combined_wrong_course'))), [rows])
  const [bulkOpen, setBulkOpen] = useState(false)
  const [bulkBusy, setBulkBusy] = useState(false)
  const downloadPreview = () => {
    const csv = [['Name', 'GCC', 'Course now', 'Batch now', 'Course after', 'Batch after'], ...fixable.map(r => [r.name, r.gcc, r.rawCourse, r.rawBatch, COMBINED, '—'])]
      .map(l => l.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n')
    const a = document.createElement('a')
    a.href = 'data:text/csv;charset=utf-8,' + encodeURIComponent('\ufeff' + csv)
    a.download = `GNSI_combined_fix_before_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }
  const runBulk = async () => {
    const yes = await askConfirm(`Set course to “Combined Course” and batch to “—” for ${fixable.length} student${fixable.length > 1 ? 's' : ''}? Their previous values are saved in the audit log.`, { confirmLabel: `Fix ${fixable.length} students`, danger: true })
    if (!yes) return
    setBulkBusy(true)
    const n = await onBulkFix(fixable.map(r => ({ id: r.id, gcc: r.gcc, before: { course: r.rawCourse, batch: r.rawBatch } })), { course: COMBINED, batch: '—' })
    setBulkBusy(false); setBulkOpen(false)
    notify(n === fixable.length ? `${n} students moved to Combined Course` : `${n} of ${fixable.length} updated — see the message above`, n === fixable.length ? 'ok' : 'warn')
  }

  const apply = async (id, fields) => { await onQuickSave(id, fields); notify('Course and batch updated', 'ok') }

  const cards = [
    { id: 'combined', n: summary.combined, label: 'Combined students', sub: `${summary.combinedEng} ENG · ${summary.combinedMm} MM · ${summary.combinedNoSection} no section`, tone: V.navy },
    { id: 'problems', n: summary.problems, label: 'Need attention', sub: summary.problems ? 'course / batch mismatches' : 'everything lines up', tone: summary.problems ? V.red : V.green },
    { id: 'blank_batch_in_combined', n: summary.byIssue.blank_batch_in_combined + summary.byIssue.no_course_no_batch, label: 'Wrongly in Combined', sub: `blank batch → Combined · ${summary.examListCombined} in Exam’s Combined list`, tone: V.amber },
    { id: 'batch_not_in_exam_setup', n: summary.byIssue.batch_not_in_exam_setup, label: 'Invisible in Exams', sub: 'batch not recognised', tone: V.red },
  ]
  const filters = [
    ['problems', 'Needs attention'], ['combined', 'All Combined'], ['combined_wrong_batch', 'Combined + real batch'], ['combined_wrong_course', 'Batch says Combined'], ['blank_batch_in_combined', 'Blank batch'],
    ['no_course_no_batch', 'No course & batch'], ['course_batch_conflict', 'Course ≠ batch'], ['batch_not_in_exam_setup', 'Batch not recognised'], ['all', 'Everyone'],
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <div style={{ fontFamily: V.serif, fontSize: isMobile ? 20 : 24, fontWeight: 600, color: V.t1 }}>Course Check</div>
        <div style={{ fontSize: 12.5, color: V.t3, marginTop: 2 }}>Combined Course students, and anyone whose course/batch here doesn’t match the Exams module — fix them in place.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12 }}>
        {cards.map(c => (
          <button key={c.label} onClick={() => setFilter(c.id)} style={{ textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', background: V.surface, border: `1px solid ${filter === c.id ? V.navy : V.border}`, borderRadius: 16, padding: '14px 16px', boxShadow: filter === c.id ? '0 0 0 3px rgba(19,42,79,.12)' : 'none' }}>
            <div style={{ fontFamily: V.serif, fontSize: 30, fontWeight: 600, color: c.tone, lineHeight: 1 }}>{c.n}</div>
            <div style={{ fontWeight: 700, fontSize: 13, color: V.t1, marginTop: 6 }}>{c.label}</div>
            <div style={{ fontSize: 11.5, color: V.t3, marginTop: 2 }}>{c.sub}</div>
          </button>
        ))}
      </div>

      {fixable.length > 0 && can?.write && onBulkFix && (
        <div style={{ background: V.surface, border: `1.5px solid ${V.gold}`, borderRadius: 16, overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '14px 18px' }}>
            <span style={{ fontSize: 22 }}>🛠️</span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <b style={{ color: V.t1, fontSize: 14 }}>{fixable.length} Combined Course student{fixable.length > 1 ? 's are' : ' is'} filed under the wrong course or batch</b>
              <div style={{ fontSize: 12, color: V.t3, marginTop: 2 }}>Fix them all at once: course → Combined Course, batch → “—”. Dropouts are left alone.</div>
            </div>
            <button onClick={() => setBulkOpen(o => !o)} style={{ height: 36, padding: '0 16px', borderRadius: 10, border: `1px solid ${V.border2}`, background: V.surface, color: V.t1, fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>{bulkOpen ? 'Hide list' : 'Review list'}</button>
            <button onClick={runBulk} disabled={bulkBusy} style={{ height: 36, padding: '0 18px', borderRadius: 10, border: 'none', background: `linear-gradient(180deg,${V.navy2},${V.navy})`, color: '#fff', fontWeight: 700, fontSize: 13, cursor: bulkBusy ? 'wait' : 'pointer', fontFamily: 'inherit' }}>{bulkBusy ? 'Fixing…' : `Fix all ${fixable.length}`}</button>
          </div>
          {bulkOpen && (
            <div style={{ borderTop: `1px solid ${V.border}`, maxHeight: 280, overflowY: 'auto' }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 18px' }}>
                <button onClick={downloadPreview} style={{ border: 'none', background: 'none', color: V.navy2, fontWeight: 700, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>📥 Download this list (before values)</button>
              </div>
              {fixable.map(r => (
                <div key={r.id} style={{ display: 'flex', gap: 10, padding: '7px 18px', borderTop: `1px solid ${V.border}`, fontSize: 12.5, color: V.t2, flexWrap: 'wrap' }}>
                  <b style={{ flex: '1 1 160px', color: V.t1 }}>{r.name} <span style={{ color: V.t4, fontWeight: 500 }}>{r.gcc ? `GCC ${r.gcc}` : ''}</span></b>
                  <span style={{ flex: '2 1 260px' }}>{r.rawCourse || 'no course'} · {r.rawBatch || 'no batch'} <b style={{ color: V.green }}>→ Combined Course · —</b></span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ fontSize: 12.5, color: V.t2, lineHeight: 1.6, background: V.goldBg, border: `1px solid ${V.goldLine}`, borderRadius: 12, padding: '10px 14px' }}>
        <b style={{ color: V.navy }}>Why this matters:</b> Exams files a student with <b>no batch</b> under <b>Combined</b>, and a Combined student with a <b>real batch</b> under that batch instead.
        Either way they end up in the wrong exam list. Combined students should have course “Combined Course” and batch “—”.
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {filters.map(([id, label]) => (
          <button key={id} onClick={() => setFilter(id)} style={{ border: `1px solid ${filter === id ? V.navy : V.border2}`, background: filter === id ? V.navy : V.surface, color: filter === id ? '#fff' : V.t2, borderRadius: 99, padding: '7px 13px', fontWeight: 600, fontSize: 12.5, cursor: 'pointer', fontFamily: 'inherit' }}>
            {label}{ISSUES[id] ? ` (${summary.byIssue[id]})` : ''}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name or GCC no…" style={{ flex: 1, minWidth: 200, height: 40, padding: '0 14px', border: `1px solid ${V.border2}`, borderRadius: 11, background: V.surface, color: V.t1, fontFamily: 'inherit', fontSize: 13.5 }} />
        <label style={{ fontSize: 12.5, color: V.t3, display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={showDrop} onChange={e => setShowDrop(e.target.checked)} /> include dropouts</label>
      </div>

      <div style={{ background: V.surface, border: `1px solid ${V.border}`, borderRadius: 16, overflow: 'hidden' }}>
        {visible.length === 0 && <div style={{ padding: 34, textAlign: 'center', color: V.t3, fontSize: 13 }}>{filter === 'problems' ? '✅ No mismatches — Students and Exams agree.' : 'No students match this filter.'}</div>}
        {visible.slice(0, 200).map(r => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1.1fr 1.2fr 1.6fr', gap: 12, padding: '14px 18px', borderTop: `1px solid ${V.border}`, alignItems: 'start' }}>
            <div>
              <b style={{ color: V.t1, fontSize: 13.5 }}>{r.name}</b>
              <div style={{ fontSize: 11.5, color: V.t4 }}>{r.gcc ? `GCC ${r.gcc}` : '—'}{/dropout/i.test(r.status) ? ' · dropout' : ''}</div>
              <div style={{ fontSize: 11.5, color: V.t3, marginTop: 6 }}>Here: {r.rawCourse || 'no course'} · {r.rawBatch || 'no batch'}</div>
              <div style={{ fontSize: 11.5, color: V.t3 }}>Exams: {r.examSaysCombined ? 'Combined Navodaya' : r.examKey || '—'}{r.section ? ` · ${r.section}` : ''}</div>
            </div>
            <div>
              {r.issues.length === 0 ? <span style={{ background: V.greenBg, color: V.green, borderRadius: 99, padding: '3px 9px', fontWeight: 700, fontSize: 11 }}>Matches</span> : r.issues.map(i => (
                <div key={i} style={{ marginBottom: 6 }}>
                  <span style={{ background: SEV[ISSUES[i].sev].bg, color: SEV[ISSUES[i].sev].c, borderRadius: 99, padding: '3px 9px', fontWeight: 700, fontSize: 11, whiteSpace: 'nowrap' }}>{ISSUES[i].label}</span>
                </div>
              ))}
            </div>
            <div>{r.issues.some(i => ISSUES[i].sev !== 'info') && <FixEditor r={r} onApply={apply} disabled={!can?.write} />}</div>
          </div>
        ))}
        {visible.length > 200 && <div style={{ padding: '10px 18px', fontSize: 12, color: V.t3, borderTop: `1px solid ${V.border}` }}>Showing the first 200 of {visible.length} — fix these and the rest will appear.</div>}
      </div>
    </div>
  )
}
