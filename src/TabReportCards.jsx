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

const COURSE_STRUCTURE = {
  Sainik:     ['Achiever', 'Leader', 'Champion'],
  Navodaya:   ['Umeed', 'Lakshya'],
  Foundation: ['Prime', 'Elite'],
  Combined:   ['—'],
}
const COURSES = Object.keys(COURSE_STRUCTURE)

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

const TERMS = ['Term 1', 'Term 2', 'Half-Yearly', 'Annual', 'Unit Test 1', 'Unit Test 2']

export default function TabReportCards({ courseData, staff, currentUser }) {
  const [course, setCourse]   = useState('')
  const [subtype, setSubtype] = useState('')
  const [term, setTerm]       = useState(TERMS[0])
  const [students, setStudents] = useState([])
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [marks, setMarks] = useState({}) // { subject_name: { marks_obtained, max_marks, remarks } }
  const [loadingSubjects, setLoadingSubjects] = useState(false)
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savedId, setSavedId] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (msg, color='#16a34a') => { setToast({ msg, color }); setTimeout(() => setToast(null), 3000) }

  // Fetch subjects for the selected course from the real syllabus data
  useEffect(() => {
    if (!course) { setSubjects([]); return }
    setLoadingSubjects(true)
    supabase.from('teaching_syllabus').select('subject_name').eq('course', course)
      .then(({ data }) => {
        const names = [...new Set((data||[]).map(r => r.subject_name))].sort()
        setSubjects(names)
        setMarks(prev => {
          const next = {}
          names.forEach(n => { next[n] = prev[n] || { marks_obtained:'', max_marks:100, remarks:'' } })
          return next
        })
        setLoadingSubjects(false)
      })
  }, [course])

  // Fetch students for the selected course + batch
  useEffect(() => {
    if (!course) { setStudents([]); return }
    setLoadingStudents(true)
    let q = supabase.from('students').select('id,name,roll_number,house').eq('status','Active').eq('course', course)
    if (subtype) q = q.eq('batch', subtype)
    q.order('name').then(({ data }) => { setStudents(data || []); setLoadingStudents(false) })
  }, [course, subtype])

  // Load any previously saved report card for this student+term so re-opening resumes work
  useEffect(() => {
    if (!selectedStudent || !term) return
    supabase.from('report_cards').select('id, report_card_subjects(subject_name,marks_obtained,max_marks,remarks)')
      .eq('student_id', selectedStudent.id).eq('term', term).maybeSingle()
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
  }, [selectedStudent, term])

  const overall = useMemo(() => {
    let obtained = 0, max = 0
    subjects.forEach(s => {
      const m = marks[s]
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
    setSaving(true)
    try {
      const payload = {
        student_id: selectedStudent.id, student_name: selectedStudent.name,
        course, subtype: subtype || null, term,
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
        subject_name: s,
        marks_obtained: marks[s]?.marks_obtained === '' ? null : Number(marks[s]?.marks_obtained),
        max_marks: Number(marks[s]?.max_marks) || 100,
        grade: gradeFor(marks[s]?.max_marks ? (Number(marks[s]?.marks_obtained||0)/Number(marks[s].max_marks))*100 : null),
        remarks: marks[s]?.remarks || '',
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
    const doc = new jsPDF()
    const pageWidth = doc.internal.pageSize.getWidth()

    doc.setFontSize(16); doc.setFont(undefined, 'bold')
    doc.text('GNSI — Guidance Navodaya & Sainik Institute', pageWidth/2, 18, { align:'center' })
    doc.setFontSize(11); doc.setFont(undefined, 'normal')
    doc.text('Report Card', pageWidth/2, 26, { align:'center' })

    doc.setFontSize(10)
    doc.text(`Student: ${selectedStudent.name}`, 14, 38)
    doc.text(`Roll No: ${selectedStudent.roll_number || '—'}`, 14, 44)
    doc.text(`Course: ${course}${subtype ? ' / ' + subtype : ''}`, 14, 50)
    doc.text(`Term: ${term}`, pageWidth - 60, 38)
    doc.text(`House: ${selectedStudent.house || '—'}`, pageWidth - 60, 44)
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, pageWidth - 60, 50)

    const rows = subjects.map(s => {
      const m = marks[s] || {}
      const pct = m.max_marks ? (Number(m.marks_obtained||0)/Number(m.max_marks))*100 : null
      return [s, m.marks_obtained ?? '—', m.max_marks ?? '—', gradeFor(pct) || '—', m.remarks || '']
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

    doc.save(`${selectedStudent.name.replace(/\s+/g,'_')}_${term.replace(/\s+/g,'_')}_ReportCard.pdf`)
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
          Subjects are pulled live from the Syllabus tab for the selected course.
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(160px,1fr))', gap:12 }}>
          <div>
            <label style={S.label}>Course</label>
            <select value={course} onChange={e => { setCourse(e.target.value); setSubtype(''); setSelectedStudent(null) }} style={S.input}>
              <option value="">Select course…</option>
              {COURSES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Batch</label>
            <select value={subtype} disabled={!course} onChange={e => { setSubtype(e.target.value); setSelectedStudent(null) }} style={S.input}>
              <option value="">All batches…</option>
              {(course ? COURSE_STRUCTURE[course]||[] : []).map(b => <option key={b} value={b}>{b}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Term / Exam</label>
            <select value={term} onChange={e => setTerm(e.target.value)} style={S.input}>
              {TERMS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Student</label>
            <select value={selectedStudent?.id || ''} disabled={!course || loadingStudents}
              onChange={e => setSelectedStudent(students.find(s => s.id === e.target.value) || null)} style={S.input}>
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
                {course}{subtype ? ` · ${subtype}` : ''} · {term}
                {selectedStudent.roll_number ? ` · Roll ${selectedStudent.roll_number}` : ''}
                {selectedStudent.house ? ` · ${selectedStudent.house} House` : ''}
              </div>
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
              No subjects found for {course} in the Syllabus tab yet.
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
                    const m = marks[s] || { marks_obtained:'', max_marks:100, remarks:'' }
                    const pct = m.max_marks ? (Number(m.marks_obtained||0)/Number(m.max_marks))*100 : null
                    const g = gradeFor(pct)
                    return (
                      <tr key={s} style={{ borderBottom:'1px solid #f1f5f9' }}>
                        <td style={{ padding:'8px 6px', fontWeight:600, color:'#1e293b' }}>{s}</td>
                        <td style={{ padding:'8px 6px' }}>
                          <input type="number" min="0" value={m.marks_obtained}
                            onChange={e => updateSubjectField(s, 'marks_obtained', e.target.value)}
                            style={{ ...S.input, padding:'6px 8px' }}/>
                        </td>
                        <td style={{ padding:'8px 6px' }}>
                          <input type="number" min="1" value={m.max_marks}
                            onChange={e => updateSubjectField(s, 'max_marks', e.target.value)}
                            style={{ ...S.input, padding:'6px 8px' }}/>
                        </td>
                        <td style={{ padding:'8px 6px', textAlign:'center' }}>
                          {g && <span style={{ fontWeight:800, color:gradeColor(g) }}>{g}</span>}
                        </td>
                        <td style={{ padding:'8px 6px' }}>
                          <input value={m.remarks} placeholder="Optional remarks…"
                            onChange={e => updateSubjectField(s, 'remarks', e.target.value)}
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