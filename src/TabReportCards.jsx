// ============================================================
//  GNSI Portal — Report Card Generator (Teaching module tab)
// ============================================================
// Pulls subjects live from teaching_syllabus per course, so the subject
// list always matches what's actually maintained in the Syllabus tab.
// Marks + grade + remarks are entered per subject, saved to
// report_cards / report_card_subjects, and exportable as a PDF.

import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

// Course/batch list used to be a hardcoded 4-track model (Sainik/Navodaya/
// Foundation/Combined → Achiever/Leader/...) that didn't know about batches
// created later in the Exams module (e.g. "Combined Navodaya Course(ENG)",
// "Combined Navodaya Course (MM)") — exactly the incompatibility that made
// this tab's course/batch picker diverge from Exams' Bulk Report Cards. This
// now reads the SAME system_settings.course_subjects config Exams.jsx reads,
// so every batch that exists there shows up here identically.
function useLiveCourseSubjects() {
  const [courseSubjects, setCourseSubjects] = useState({})
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('system_settings').select('value').eq('key', 'course_subjects').single()
      .then(({ data }) => {
        try { setCourseSubjects(data?.value ? JSON.parse(data.value) : {}) }
        catch { setCourseSubjects({}) }
        setLoading(false)
      })
  }, [])
  return { courseSubjects, loading }
}

const GRADE_SCALE = [
  { min:90, grade:'A1' }, { min:80, grade:'A2' }, { min:70, grade:'B1' },
  { min:60, grade:'B2' }, { min:50, grade:'C1' }, { min:40, grade:'C2' },
  { min:33, grade:'D' },  { min:0,  grade:'E' },
]
const gradeFor = pct => {
  if (pct == null || pct === '') return ''
  const p = Number(pct)
  return (GRADE_SCALE.find(g => p >= g.min) || GRADE_SCALE[GRADE_SCALE.length-1]).grade
}
// Percentage for one subject, or null when no mark has been entered (a
// blank mark must not count as 0 — that printed a red "E" on empty rows).
const isBlankMark = v => v === '' || v === null || v === undefined
const pctOf = m => (!m || isBlankMark(m.marks_obtained) || !Number(m.max_marks)) ? null : (Number(m.marks_obtained) / Number(m.max_marks)) * 100
const gradeColor = grade => {
  if (['A1','A2'].includes(grade)) return '#16a34a'
  if (['B1','B2'].includes(grade)) return '#0891b2'
  if (['C1','C2'].includes(grade)) return '#d97706'
  if (grade === 'D') return '#ea580c'
  if (grade === 'E') return '#dc2626'
  return '#8a93a6'
}

const S = {
  card: { background:'white', border:'1px solid #e8e3d8', borderRadius:18, boxShadow:'0 1px 2px rgba(19,42,79,.05),0 12px 32px -22px rgba(19,42,79,.35)', padding:20, marginBottom:16 },
  input: { padding:'9px 12px', borderRadius:11, border:'1px solid #d9d2c2', fontSize:13, width:'100%', boxSizing:'border-box', outline:'none', background:'#fff', color:'#0f1b2e', fontFamily:'inherit', minHeight:40 },
  label: { fontSize:10.5, fontWeight:800, color:'#5d6b82', marginBottom:5, display:'block', textTransform:'uppercase', letterSpacing:'.1em' },
  btn: (bg, disabled) => ({ padding:'9px 16px', borderRadius:8, border:'none', background:disabled?'#e8e3d8':bg, color:disabled?'#8a93a6':'white', fontWeight:700, fontSize:13, cursor:disabled?'not-allowed':'pointer' }),
  btnSm: bg => ({ padding:'5px 10px', borderRadius:6, border:'none', background:bg, color:'white', fontWeight:700, fontSize:11.5, cursor:'pointer' }),
}

// Exam Type + Date now replace the old free-standing TERMS list ('Term 1',
// 'Unit Test 1', ...) which had no connection to any real exam sitting.
// Selecting an actual exam_type + exam_date here is what lets this tab pull
// the SAME marks already entered in Exams.jsx's Mark Entry / CSV import,
// instead of asking someone to re-type every subject's marks from scratch.

export default function TabReportCards({ currentUser }) {
  const { courseSubjects, loading: loadingCourseSubjects } = useLiveCourseSubjects()
  const courses = useMemo(() => Object.keys(courseSubjects), [courseSubjects])

  const [course, setCourse]   = useState('') // this is actually the BATCH (e.g. "ACHIEVER", "Combined Navodaya Course(ENG)") — kept the name `course` to avoid touching every call site below
  const [examTypes, setExamTypes] = useState([])
  const [examType, setExamType]   = useState('')
  const [examDates, setExamDates] = useState([])
  const [examDate, setExamDate]   = useState('')
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [subjects, setSubjects] = useState([]) // [{ subject, examId, maxMarks }]
  const [marks, setMarks] = useState({}) // { subject_name: { marks_obtained, max_marks, remarks } }
  const [loadingSubjects, setLoadingSubjects] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [loadingRealMarks, setLoadingRealMarks] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (msg, color='#16a34a') => { setToast({ msg, color }); setTimeout(() => setToast(null), 3000) }

  // Exam types list — same table Exams.jsx reads from.
  useEffect(() => {
    supabase.from('exam_types').select('*').order('created_at')
      .then(({ data }) => { setExamTypes(data || []); if (data?.length && !examType) setExamType(data[0].id) })
  }, []) // eslint-disable-line

  // Subjects for the selected batch + exam type — resolved from exam_schedule
  // (the real, live schedule Exams.jsx's Mark Entry writes to), NOT from
  // teaching_syllabus. This is the core of the sync: the subject list, max
  // marks, and exam_id linkage all come from the same source Bulk Report
  // Cards uses, so a subject added/renamed in Exams shows up here too.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the server when the selection changes
    if (!course || !examType) { setSubjects([]); return }
    setLoadingSubjects(true)
    supabase.from('exam_schedule').select('id, subject, total_marks, exam_date')
      .eq('exam_type_id', examType).eq('course', course).order('exam_date')
      .then(({ data }) => {
        const sched = data || []
        setSubjects(sched.map(s => ({ subject: s.subject, examId: s.id, maxMarks: s.total_marks || 100 })))
        setExamDates([...new Set(sched.map(s => s.exam_date).filter(Boolean))].sort())
        setMarks(prev => {
          const next = {}
          sched.forEach(s => { next[s.subject] = prev[s.subject] || { marks_obtained:'', max_marks:s.total_marks||100, remarks:'' } })
          return next
        })
        setLoadingSubjects(false)
      })
  }, [course, examType])

  // Students for the selected batch — matches class_name the same
  // case-insensitive way Exams.jsx does (a prior one-sided .toUpperCase()
  // comparison here was part of why this tab silently showed 0 students for
  // any mixed-case batch name like "Combined Navodaya Course(ENG)").
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the server when the selection changes
    if (!course) { setStudents([]); return }
    setLoadingStudents(true)
    Promise.all([
      supabase.from('students').select('id,name,roll_number,house,class_name,gcc_no,admission_no').eq('status','Active'),
      supabase.from('student_secondary_batches').select('student_id, batch'),
    ]).then(([{ data: allStudents }, { data: secRows }]) => {
      const secMap = {}
      ;(secRows || []).forEach(r => { (secMap[r.student_id] = secMap[r.student_id] || []).push(r.batch) })
      const target = course.trim().toUpperCase()
      // A student matches this batch either as their PRIMARY class_name, or
      // via a secondary-batch tag (dual-appearing students, e.g. a Sainik
      // student also sitting the Combined Navodaya exam) — same model as
      // Exams.jsx's expandWithSecondaryBatches.
      const matched = (allStudents || []).filter(s =>
        (s.class_name || '').trim().toUpperCase() === target ||
        (secMap[s.id] || []).some(b => b.trim().toUpperCase() === target)
      )
      setStudents(matched.sort((a,b) => (a.name||'').localeCompare(b.name||'')))
      setLoadingStudents(false)
    })
  }, [course])

  // Marks for the selected student + exam sitting, rebuilt from scratch every
  // time the student, batch, exam type or date changes (the old version
  // merged into whatever was on screen, so a previous student's marks stuck
  // to the next student, and two parallel loads raced each other).
  //   1. live marks from exam_marks for THIS batch's scheduled exam_ids —
  //      scoped by exam_id, never exam_type_id alone, so a dual-appearing
  //      student's marks from a DIFFERENT batch can't bleed in
  //   2. a previously saved OFFICIAL report card (report_cards /
  //      report_card_subjects), which can carry remarks and finalized marks
  // A saved mark wins over the live one, but a blank saved mark never hides
  // a real live mark.
  const [liveInfo, setLiveInfo] = useState(null) // { withMarks, total } from the Exams module
  useEffect(() => {
    if (!selectedStudent || !subjects.length) return
    let live = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the server when the selection changes
    setLoadingRealMarks(true)
    setMarks(Object.fromEntries(subjects.map(sub => [sub.subject, { marks_obtained:'', max_marks:sub.maxMarks, remarks:'' }])))
    const examTypeName = examTypes.find(t => t.id === examType)?.name || examType
    Promise.all([
      supabase.from('exam_marks').select('exam_id, marks_obtained')
        .eq('student_id', selectedStudent.id).in('exam_id', subjects.map(sub => sub.examId)),
      examDate
        ? supabase.from('report_cards').select('id, report_card_subjects(subject_name,marks_obtained,max_marks,remarks)')
            .eq('student_id', selectedStudent.id).eq('term', examTypeName).eq('exam_date', examDate).maybeSingle()
        : Promise.resolve({ data: null }),
    ]).then(([{ data: liveRows }, { data: saved }]) => {
      if (!live) return
      const liveBy = {}
      subjects.forEach(sub => {
        const row = (liveRows || []).find(r => r.exam_id === sub.examId)
        if (row && row.marks_obtained !== null && row.marks_obtained !== undefined) liveBy[sub.subject] = row.marks_obtained
      })
      const savedBy = {}
      ;(saved?.report_card_subjects || []).forEach(r => { savedBy[r.subject_name] = r })
      setMarks(Object.fromEntries(subjects.map(sub => {
        const sv = savedBy[sub.subject]
        const savedMark = sv && sv.marks_obtained !== null && sv.marks_obtained !== undefined && sv.marks_obtained !== '' ? sv.marks_obtained : undefined
        return [sub.subject, {
          marks_obtained: savedMark ?? liveBy[sub.subject] ?? '',
          max_marks: sv?.max_marks ?? sub.maxMarks,
          remarks: sv?.remarks || '',
        }]
      })))
      setSavedId(saved?.id || null)
      setLiveInfo({ withMarks: Object.keys(liveBy).length, total: subjects.length })
      setLoadingRealMarks(false)
    })
    return () => { live = false }
  }, [selectedStudent, subjects, examType, examDate]) // eslint-disable-line react-hooks/exhaustive-deps

  const overall = useMemo(() => {
    let obtained = 0, max = 0
    subjects.forEach(s => {
      const m = marks[s.subject]
      if (m && !isBlankMark(m.marks_obtained) && m.max_marks) {
        obtained += Number(m.marks_obtained)
        max += Number(m.max_marks)
      }
    })
    const pct = max > 0 ? Math.round((obtained/max)*1000)/10 : 0
    return { obtained, max, pct, grade: max > 0 ? gradeFor(pct) : '' }
  }, [marks, subjects])

  const updateSubjectField = (subject, field, value) => {
    setMarks(prev => ({ ...prev, [subject]: { ...prev[subject], [field]: value } }))
  }

  const handleSave = async () => {
    if (!selectedStudent) { showToast('Select a student first', '#dc2626'); return }
    if (!examType || !examDate) { showToast('Select an exam type and date first', '#dc2626'); return }
    setSaving(true)
    try {
      const examTypeName = examTypes.find(t => t.id === examType)?.name || examType
      const payload = {
        student_id: selectedStudent.id, student_name: selectedStudent.name,
        course, subtype: null, term: examTypeName, exam_date: examDate,
        overall_percentage: overall.pct, overall_grade: overall.grade,
        generated_by: currentUser?.name || null,
      }
      let reportCardId = savedId
      if (reportCardId) {
        const { error } = await supabase.from('report_cards').update(payload).eq('id', reportCardId)
        if (error) throw error
        await supabase.from('report_card_subjects').delete().eq('report_card_id', reportCardId)
      } else {
        const { data, error } = await supabase.from('report_cards').insert([payload]).select().single()
        if (error) throw error
        reportCardId = data.id
        setSavedId(data.id)
      }
      const subjectRows = subjects.map(s => ({
        report_card_id: reportCardId,
        subject_name: s.subject,
        marks_obtained: isBlankMark(marks[s.subject]?.marks_obtained) ? null : Number(marks[s.subject].marks_obtained),
        max_marks: Number(marks[s.subject]?.max_marks) || s.maxMarks || 100,
        grade: gradeFor(pctOf(marks[s.subject])) || null,
        remarks: marks[s.subject]?.remarks || '',
      }))
      const { error: subErr } = await supabase.from('report_card_subjects').insert(subjectRows)
      if (subErr) throw subErr
      showToast('Report card saved ✅')
    } catch (e) {
      showToast('Save failed: ' + e.message, '#dc2626')
    } finally {
      setSaving(false)
    }
  }

  const handleDownloadPDF = () => {
    if (!selectedStudent) { showToast('Select a student first', '#dc2626'); return }
    const examTypeName = examTypes.find(t => t.id === examType)?.name || 'Exam'
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFontSize(16); doc.setFont(undefined, 'bold')
    doc.text('GNSI — Guidance Navodaya & Sainik Institute', pageWidth/2, 18, { align:'center' })
    doc.setFontSize(11); doc.setFont(undefined, 'normal')
    doc.text('Report Card', pageWidth/2, 26, { align:'center' })

    doc.setFontSize(10)
    doc.text(`Student: ${selectedStudent.name}`, 14, 38)
    doc.text(`Roll No: ${selectedStudent.roll_number || '—'}`, 14, 44)
    doc.text(`Course: ${course}`, 14, 50)
    doc.text(`Exam: ${examTypeName}${examDate ? ' (' + examDate + ')' : ''}`, pageWidth - 80, 38)
    doc.text(`House: ${selectedStudent.house || '—'}`, pageWidth - 80, 44)
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, pageWidth - 80, 50)

    const rows = subjects.map(s => {
      const m = marks[s.subject] || {}
      return [s.subject, isBlankMark(m.marks_obtained) ? '—' : m.marks_obtained, m.max_marks ?? '—', gradeFor(pctOf(m)) || '—', m.remarks || '']
    })

    autoTable(doc, {
      startY: 58,
      head: [['Subject', 'Marks Obtained', 'Max Marks', 'Grade', 'Remarks']],
      body: rows,
      theme: 'grid',
      headStyles: { fillColor: [30, 58, 95] },
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: { 4: { cellWidth: 55 } },
    })

    const finalY = doc.lastAutoTable.finalY + 10
    doc.setFontSize(11); doc.setFont(undefined, 'bold')
    doc.text(`Overall: ${overall.obtained} / ${overall.max}  (${overall.pct}%)  —  Grade: ${overall.grade}`, 14, finalY)

    doc.setFontSize(9); doc.setFont(undefined, 'normal')
    doc.text('Class Teacher: ________________________', 14, finalY + 24)
    doc.text('Principal: ________________________', pageWidth - 90, finalY + 24)

    doc.save(`${selectedStudent.name.replace(/\s+/g,'_')}_${examTypeName.replace(/\s+/g,'_')}_ReportCard.pdf`)
  }

  return (
    <div>
      {toast && (
        <div style={{ position:'fixed', top:20, right:20, zIndex:1000, background:toast.color, color:'white', padding:'10px 18px', borderRadius:8, fontWeight:700, fontSize:13, boxShadow:'0 4px 12px rgba(0,0,0,.15)' }}>
          {toast.msg}
        </div>
      )}

      <div style={S.card}>
        <div style={{ fontFamily:"'Fraunces','Playfair Display',Georgia,serif", fontWeight:600, fontSize:19, color:'#0f1b2e', marginBottom:4 }}>🎓 Report Card Generator</div>
        <div style={{ fontSize:12.5, color:'#5d6b82', marginBottom:16 }}>
          Batches and marks are pulled live from the Exams module — the same source Bulk Report Cards uses — so both stay in sync.
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:12 }}>
          <div>
            <label style={S.label}>Batch</label>
            <select value={course} disabled={loadingCourseSubjects} onChange={e => { setCourse(e.target.value); setSelectedStudent(null) }} style={S.input}>
              <option value="">{loadingCourseSubjects ? 'Loading…' : 'Select batch…'}</option>
              {courses.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Exam Type</label>
            <select value={examType} onChange={e => { setExamType(e.target.value); setExamDate(''); setSelectedStudent(null) }} style={S.input}>
              <option value="">Select exam type…</option>
              {examTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Exam Date</label>
            <select value={examDate} disabled={!examDates.length} onChange={e => setExamDate(e.target.value)} style={S.input}>
              <option value="">{examDates.length ? 'Select date…' : 'No schedule found'}</option>
              {examDates.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Student</label>
            <select value={selectedStudent?.id ?? ''} disabled={!course || loadingStudents}
              onChange={e => setSelectedStudent(students.find(s => String(s.id) === e.target.value) || null)} style={S.input}>
              <option value="">{loadingStudents ? 'Loading…' : `Select student (${students.length})…`}</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.name}{s.roll_number ? ` (${s.roll_number})` : ''}</option>)}
            </select>
          </div>
        </div>
      </div>

      {selectedStudent && (
        <div style={S.card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, flexWrap:'wrap', gap:10 }}>
            <div>
              <div style={{ fontWeight:800, fontSize:15, color:'#14213d' }}>{selectedStudent.name}</div>
              <div style={{ fontSize:12, color:'#5d6b82' }}>
                {course} · {examTypes.find(t => t.id === examType)?.name || ''}{examDate ? ` · ${examDate}` : ''}
                {selectedStudent.roll_number ? ` · Roll ${selectedStudent.roll_number}` : ''}
                {selectedStudent.house ? ` · ${selectedStudent.house} House` : ''}
              </div>
              {loadingRealMarks ? <div style={{ fontSize:11, color:'#0891b2', marginTop:2 }}>⏳ Pulling marks already entered in Exams…</div>
                : liveInfo && liveInfo.withMarks === 0 ? <div role="status" style={{ fontSize:11.5, color:'#b45309', marginTop:3 }}>⚠ No marks entered in Exams → Mark Entry for this student and exam yet. Type them here, or enter them in Exams first.</div>
                : liveInfo && liveInfo.withMarks < liveInfo.total ? <div role="status" style={{ fontSize:11.5, color:'#b45309', marginTop:3 }}>Marks found in Exams for {liveInfo.withMarks} of {liveInfo.total} subjects — the rest are blank.</div>
                : liveInfo ? <div role="status" style={{ fontSize:11.5, color:'#16a34a', marginTop:3 }}>✓ Marks pulled from Exams for all {liveInfo.total} subjects.</div> : null}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={handleSave} disabled={saving} style={S.btn('#16a34a', saving)}>{saving ? 'Saving…' : (savedId ? '✓ Update' : '💾 Save')}</button>
              <button onClick={handleDownloadPDF} style={S.btn('#132a4f')}>⬇️ Download PDF</button>
            </div>
          </div>

          {loadingSubjects ? (
            <div style={{ textAlign:'center', padding:24, color:'#5d6b82', fontSize:13 }}>⏳ Loading subjects…</div>
          ) : subjects.length === 0 ? (
            <div style={{ textAlign:'center', padding:24, color:'#8a93a6', fontSize:13 }}>
              No exam schedule found for {course} under this exam type yet — set it up in Exams → Schedule first.
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid #e8e3d8' }}>
                    <th style={{ textAlign:'left', padding:'8px 6px', color:'#5d6b82', fontSize:11.5 }}>SUBJECT</th>
                    <th style={{ textAlign:'left', padding:'8px 6px', color:'#5d6b82', fontSize:11.5, width:110 }}>MARKS</th>
                    <th style={{ textAlign:'left', padding:'8px 6px', color:'#5d6b82', fontSize:11.5, width:110 }}>MAX MARKS</th>
                    <th style={{ textAlign:'center', padding:'8px 6px', color:'#5d6b82', fontSize:11.5, width:70 }}>GRADE</th>
                    <th style={{ textAlign:'left', padding:'8px 6px', color:'#5d6b82', fontSize:11.5 }}>REMARKS</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map(s => {
                    const m = marks[s.subject] || { marks_obtained:'', max_marks:s.maxMarks||100, remarks:'' }
                    const g = gradeFor(pctOf(m))
                    return (
                      <tr key={s.subject} style={{ borderBottom:'1px solid #f3f0e8' }}>
                        <td style={{ padding:'8px 6px', fontWeight:600, color:'#14213d' }}>{s.subject}</td>
                        <td style={{ padding:'8px 6px' }}>
                          <input type="number" min="0" value={m.marks_obtained}
                            onChange={e => updateSubjectField(s.subject, 'marks_obtained', e.target.value)}
                            style={{ ...S.input, padding:'6px 8px' }}/>
                        </td>
                        <td style={{ padding:'8px 6px' }}>
                          <input type="number" min="1" value={m.max_marks}
                            onChange={e => updateSubjectField(s.subject, 'max_marks', e.target.value)}
                            style={{ ...S.input, padding:'6px 8px' }}/>
                        </td>
                        <td style={{ padding:'8px 6px', textAlign:'center' }}>
                          {g && <span style={{ fontWeight:800, color:gradeColor(g) }}>{g}</span>}
                        </td>
                        <td style={{ padding:'8px 6px' }}>
                          <input value={m.remarks} placeholder="Optional remarks…"
                            onChange={e => updateSubjectField(s.subject, 'remarks', e.target.value)}
                            style={{ ...S.input, padding:'6px 8px' }}/>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <div style={{ marginTop:16, padding:'12px 16px', background:'#faf8f3', borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
                <div style={{ fontSize:13, color:'#2e3b52' }}>
                  Overall: <strong>{overall.obtained} / {overall.max}</strong> &nbsp;({overall.pct}%)
                </div>
                {overall.grade && (
                  <div style={{ fontSize:15, fontWeight:800, color:gradeColor(overall.grade) }}>
                    Grade: {overall.grade}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}