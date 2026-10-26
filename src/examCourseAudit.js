// examCourseAudit.js — finds Combined Course students and every place where the
// Students module and the Exams module disagree about a student's course/batch.
//
// Students says:  courseOf(s) / batchOf(s)  (course field first, else derived from batch)
// Exams says:     examKeyFor(s)             (batch → exam key; a BLANK batch means "Combined")
// The blank-batch rule is the usual source of trouble: any student with no batch
// silently lands in the Combined list in Exams, whatever their course is.
import { courseOf, batchOf, normalizeCourse, canonicalBatch, isStandardBatch } from './courseMap.js'
import { examKeyFor, COMBINED_COURSE_BATCH_LABEL } from './examBatchKey.js'

export const KEY_TRACK = {
  ACHIEVER: 'Sainik', LEADER: 'Sainik', CHAMPION: 'Sainik',
  'LAKSHYA - A': 'Navodaya', 'LAKSHYA - B': 'Navodaya', LAKSHYA: 'Navodaya', UMEED: 'Navodaya',
  PRAGATI: 'Foundation', UDAAN: 'Foundation',
  [COMBINED_COURSE_BATCH_LABEL]: 'Combined Course',
}

export const ISSUES = {
  combined_wrong_batch: { sev: 'error', label: 'Combined, but has a real batch', fix: 'Set the batch to "—" in Students so the student appears in the Combined exam list.' },
  blank_batch_in_combined: { sev: 'error', label: 'No batch — Exams shows as Combined', fix: 'Assign the student’s real batch in Students. Until then Exams lists them under Combined.' },
  no_course_no_batch: { sev: 'error', label: 'No course and no batch', fix: 'Set the course (and batch, unless Combined) in Students. Exams currently treats them as Combined.' },
  batch_not_in_exam_setup: { sev: 'error', label: 'Batch missing from Exam setup', fix: 'Add this batch under Exams → Course Subjects, or correct the student’s batch. They are invisible in exam tools now.' },
  course_batch_conflict: { sev: 'warn', label: 'Course and batch disagree', fix: 'The course field and the batch belong to different courses. Correct whichever is wrong in Students.' },
  combined_no_section: { sev: 'info', label: 'Combined, no ENG / MM section', fix: 'Tag the medium (ENG or MM) in Exams → Students if you print reports by section.' },
  course_blank_derived: { sev: 'info', label: 'Course empty (taken from batch)', fix: 'Optional: fill the course field in Students so every module reads the same value.' },
}

const secTag = t => {
  const u = String(t || '').toUpperCase()
  if (!u.includes('COMBINED NAVODAY')) return ''
  if (/\bENG\b/.test(u)) return 'ENG'
  if (/\b(MM|MAN|MANIPURI)\b/.test(u)) return 'MM'
  return ''
}

/**
 * Audit one student.
 * @param s            student row (as loaded by Exams)
 * @param examKeys     Set of keys that exist in Exam setup (courseSubjects)
 * @param secondary    array of secondary-batch tags for this student
 */
export function auditStudent(s, examKeys, secondary = []) {
  const rawCourse = normalizeCourse(s.course)
  const rawBatch = String(s.batch || '').trim()
  const blankBatch = !rawBatch || rawBatch === '—'
  const examKey = examKeyFor(s)
  const examTrack = KEY_TRACK[examKey] || ''
  const studentsCourse = courseOf(s)
  const tags = secondary.map(secTag).filter(Boolean)
  const examSaysCombined = examKey === COMBINED_COURSE_BATCH_LABEL
  const isCombined = examSaysCombined || rawCourse === 'Combined Course' || secondary.some(t => /COMBINED NAVODAY/i.test(t))

  const issues = []
  if (rawCourse === 'Combined Course' && !blankBatch) issues.push('combined_wrong_batch')
  if (examSaysCombined && blankBatch) {
    if (!rawCourse) { if (studentsCourse === 'Unassigned') issues.push('no_course_no_batch') }
    else if (rawCourse !== 'Combined Course') issues.push('blank_batch_in_combined')
  }
  if (examKey && examKeys && !examKeys.has(examKey)) issues.push('batch_not_in_exam_setup')
  if (rawCourse && rawCourse !== 'Combined Course' && examTrack && examTrack !== rawCourse && !examSaysCombined) issues.push('course_batch_conflict')
  if (isCombined && examSaysCombined && !tags.length) issues.push('combined_no_section')
  if (!rawCourse && !blankBatch && isStandardBatch(canonicalBatch(rawBatch))) issues.push('course_blank_derived')

  return {
    id: s.id, name: s.name, gcc: s.gcc_no || s.admission_no || '', status: s.status || '',
    studentsCourse, studentsBatch: batchOf(s) === 'No batch' ? '' : batchOf(s),
    rawCourse: s.course || '', rawBatch: rawBatch,
    examKey, examTrack, isCombined, examSaysCombined, section: tags[0] || '', dual: secondary.length > 0, issues,
  }
}

/** Audit everyone. secondaryBatchMap = { studentId: [tag, …] }. */
export function auditStudents(students, courseSubjects, secondaryBatchMap = {}) {
  const keys = new Set(Object.keys(courseSubjects || {}))
  const rows = (students || []).filter(s => !s._isSecondaryBatchView).map(s => auditStudent(s, keys, secondaryBatchMap[s.id] || []))
  const live = rows.filter(r => !/dropout/i.test(r.status))
  const count = id => live.filter(r => r.issues.includes(id)).length
  const combined = live.filter(r => r.isCombined)
  return {
    rows,
    summary: {
      total: live.length,
      combined: combined.length,
      combinedEng: combined.filter(r => r.section === 'ENG').length,
      combinedMm: combined.filter(r => r.section === 'MM').length,
      combinedNoSection: combined.filter(r => !r.section).length,
      combinedBoth: combined.filter(r => r.examSaysCombined && KEY_TRACK[r.examKey]).length,
      problems: live.filter(r => r.issues.some(i => ISSUES[i].sev !== 'info')).length,
      byIssue: Object.fromEntries(Object.keys(ISSUES).map(k => [k, count(k)])),
    },
  }
}
