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
        catch (e) { setCourseSubjects({}) }
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
const gradeColor = grade => {
  if (['A1','A2'].includes(grade)) return '#16a34a'
  if (['B1','B2'].includes(grade)) return '#0891b2'
  if (['C1','C2'].includes(grade)) return '#d97706'
  if (grade === 'D') return '#ea580c'
  if (grade === 'E') return '#dc2626'
  return '#94a3b8'
}

const S = {
  card: { background:'white', border:'1px solid #e2e8f0', borderRadius:12, padding:20, marginBottom:16 },
  input: { padding:'8px 12px', borderRadius:8, border:'1.5px solid #e2e8f0', fontSize:13, width:'100%', boxSizing:'border-box', outline:'none' },
  label: { fontSize:11.5, fontWeight:700, color:'#374151', marginBottom:5, display:'block' },
  btn: (bg, disabled) => ({ padding:'9px 16px', borderRadius:8, border:'none', background:disabled?'#e2e8f0':bg, color:disabled?'#94a3b8':'white', fontWeight:700, fontSize:13, cursor:disabled?'not-allowed':'pointer' }),
  btnSm: bg => ({ padding:'5px 10px', borderRadius:6, border:'none', background:bg, color:'white', fontWeight:700, fontSize:11.5, cursor:'pointer' }),
}

// Exam Type + Date now replace the old free-standing TERMS list ('Term 1',
// 'Unit Test 1', ...) which had no connection to any real exam sitting.
// Selecting an actual exam_type + exam_date here is what lets this tab pull
// the SAME marks already entered in Exams.jsx's Mark Entry / CSV import,
// instead of asking someone to re-type every subject's marks from scratch.

export default function TabReportCards({ courseData, staff, currentUser }) {
  const { courseSubjects, loading: loadingCourseSubjects } = useLiveCourseSubjects()
  const courses = useMemo(() => Object.keys(courseSubjects), [courseSubjects])

  const [course, setCourse]   = useState('') // this is actually the BATCH (e.g. "ACHIEVER", "Combined Navodaya Course(ENG)") — kept the name `course` to avoid touching every call site below
  const [examTypes, setExamTypes] = useState([])
  const [examType, setExamType]   = useState('')
  const [examDates, setExamDates] = useState([])
  const [examDate, setExamDate]   = useState('')
  const [students, setStudents] = useState([])
  const [secondaryBatchMap, setSecondaryBatchMap] = useState({}) // { student_id: [batch, ...] } — same dual-appearing model as Exams.jsx
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
    if (!course) { setStudents([]); return }
    setLoadingStudents(true)
    Promise.all([
      supabase.from('students').select('id,name,roll_number,house,class_name,gcc_no,admission_no').eq('status','Active'),
      supabase.from('student_secondary_batches').select('student_id, batch'),
    ]).then(([{ data: allStudents }, { data: secRows }]) => {
      const secMap = {}
      ;(secRows || []).forEach(r => { (secMap[r.student_id] = secMap[r.student_id] || []).push(r.batch) })
      setSecondaryBatchMap(secMap)
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

  // Real marks prefill: once a student + exam sitting is selected, pull
  // whatever's already in exam_marks for THIS batch's scheduled exam_ids —
  // scoped exactly the same way the fixed ReportCards/BulkReports in
  // Exams.jsx are (by exam_id, never by exam_type_id alone), so a
  // dual-appearing student's marks from a DIFFERENT batch can never bleed in
  // here. This only overwrites a subject's fields if nothing has been typed
  // here yet — an in-progress manual edit is never silently clobbered by a
  // background refetch.
  useEffect(() => {
    if (!selectedStudent || !subjects.length) return
    setLoadingRealMarks(true)
    const examIds = subjects.map(s => s.examId)
    supabase.from('exam_marks').select('exam_id, marks_obtained')
      .eq('student_id', selectedStudent.id).in('exam_id', examIds)
      .then(({ data }) => {
        const bySubject = {}
        subjects.forEach(s => {
          const row = (data || []).find(r => r.exam_id === s.examId)
          if (row) bySubject[s.subject] = row.marks_obtained
        })
        setMarks(prev => {
          const next = { ...prev }
          subjects.forEach(s => {
            const already = next[s.subject]
            const isUntouched = !already || already.marks_obtained === '' || already.marks_obtained === undefined
            if (isUntouched && bySubject[s.subject] !== undefined) {
              next[s.subject] = { marks_obtained: bySubject[s.subject], max_marks: s.maxMarks, remarks: already?.remarks || '' }
            }
          })
          return next
        })
        setLoadingRealMarks(false)
      })
  }, [selectedStudent, subjects])

  // Load any previously saved OFFICIAL report card for this student + exam
  // sitting (report_cards/report_card_subjects — a separate record from the
  // raw exam_marks pulled above, since a report card can carry remarks and a
  // finalized/edited mark that differs from the live exam entry). Keyed on
  // exam type name + date, replacing the old free-text `term` field so a
  // report card is always traceable back to one real exam sitting.
  useEffect(() => {
    if (!selectedStudent || !examType || !examDate) return
    const examTypeName = examTypes.find(t => t.id === examType)?.name || examType
    supabase.from('report_cards').select('id, report_card_subjects(subject_name,marks_obtained,max_marks,remarks)')
      .eq('student_id', selectedStudent.id).eq('term', examTypeName).eq('exam_date', examDate).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSavedId(data.id)
          const loaded = {}
          ;(data.report_card_subjects || []).forEach(r => {
            loaded[r.subject_name] = { marks_obtained:r.marks_obtained ?? '', max_marks:r.max_marks ?? 100, remarks:r.remarks || '' }
          })
          setMarks(prev => ({ ...prev, ...loaded }))
        } else {
          setSavedId(null)
        }
      })
  }, [selectedStudent, examType, examDate]) // eslint-disable-line

  const overall = useMemo(() => {
    let obtained = 0, max = 0
    subjects.forEach(s => {
      const m = marks[s.subject]
      if (m && m.marks_obtained !== '' && m.max_marks) {
        obtained += Number(m.marks_obtained)
        max += Number(m.max_marks)
      }
    })
    const pct = max > 0 ? Math.round((obtained/max)*1000)/10 : 0
    return { obtained, max, pct, grade: gradeFor(pct) }
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
        marks_obtained: marks[s.subject]?.marks_obtained === '' ? null : Number(marks[s.subject]?.marks_obtained),
        max_marks: Number(marks[s.subject]?.max_marks) || s.maxMarks || 100,
        grade: gradeFor(marks[s.subject]?.max_marks ? (Number(marks[s.subject]?.marks_obtained||0)/Number(marks[s.subject].max_marks))*100 : null),
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
      const pct = m.max_marks ? (Number(m.marks_obtained||0)/Number(m.max_marks))*100 : null
      return [s.subject, m.marks_obtained ?? '—', m.max_marks ?? '—', gradeFor(pct) || '—', m.remarks || '']
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
        <div style={{ fontWeight:800, fontSize:16, color:'#1e293b', marginBottom:4 }}>🎓 Report Card Generator</div>
        <div style={{ fontSize:12.5, color:'#64748b', marginBottom:16 }}>
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
              <div style={{ fontWeight:800, fontSize:15, color:'#1e293b' }}>{selectedStudent.name}</div>
              <div style={{ fontSize:12, color:'#64748b' }}>
                {course} · {examTypes.find(t => t.id === examType)?.name || ''}{examDate ? ` · ${examDate}` : ''}
                {selectedStudent.roll_number ? ` · Roll ${selectedStudent.roll_number}` : ''}
                {selectedStudent.house ? ` · ${selectedStudent.house} House` : ''}
              </div>
              {loadingRealMarks && <div style={{ fontSize:11, color:'#0891b2', marginTop:2 }}>⏳ Pulling marks already entered in Exams…</div>}
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={handleSave} disabled={saving} style={S.btn('#16a34a', saving)}>{saving ? 'Saving…' : (savedId ? '✓ Update' : '💾 Save')}</button>
              <button onClick={handleDownloadPDF} style={S.btn('#1e3a5f')}>⬇️ Download PDF</button>
            </div>
          </div>

          {loadingSubjects ? (
            <div style={{ textAlign:'center', padding:24, color:'#64748b', fontSize:13 }}>⏳ Loading subjects…</div>
          ) : subjects.length === 0 ? (
            <div style={{ textAlign:'center', padding:24, color:'#94a3b8', fontSize:13 }}>
              No exam schedule found for {course} under this exam type yet — set it up in Exams → Schedule first.
            </div>
          ) : (
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid #e2e8f0' }}>
                    <th style={{ textAlign:'left', padding:'8px 6px', color:'#64748b', fontSize:11.5 }}>SUBJECT</th>
                    <th style={{ textAlign:'left', padding:'8px 6px', color:'#64748b', fontSize:11.5, width:110 }}>MARKS</th>
                    <th style={{ textAlign:'left', padding:'8px 6px', color:'#64748b', fontSize:11.5, width:110 }}>MAX MARKS</th>
                    <th style={{ textAlign:'center', padding:'8px 6px', color:'#64748b', fontSize:11.5, width:70 }}>GRADE</th>
                    <th style={{ textAlign:'left', padding:'8px 6px', color:'#64748b', fontSize:11.5 }}>REMARKS</th>
                  </tr>
                </thead>
                <tbody>
                  {subjects.map(s => {
                    const m = marks[s.subject] || { marks_obtained:'', max_marks:s.maxMarks||100, remarks:'' }
                    const pct = m.max_marks ? (Number(m.marks_obtained||0)/Number(m.max_marks))*100 : null
                    const g = gradeFor(pct)
                    return (
                      <tr key={s.subject} style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'8px 6px', fontWeight:600, color:'#1e293b' }}>{s.subject}</td>
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

              <div style={{ marginTop:16, padding:'12px 16px', background:'#f8fafc', borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:10 }}>
                <div style={{ fontSize:13, color:'#374151' }}>
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