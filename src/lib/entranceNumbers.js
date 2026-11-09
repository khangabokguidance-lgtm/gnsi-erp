// entranceNumbers.js — application numbers, roll numbers and hall-ticket numbers for the entrance exam board.
// Pure and import-free, so the server functions in api/entrance can use exactly the same rules as the portal.
export const EXAM_TYPE_COURSE = {
  'Sainik School': 'sainik', 'Navodaya (JNV)': 'navodaya', 'RMS (Military School)': 'rms', 'Foundation': 'foundation', 'Combined': '',
}
export const COURSE_CODE = { sainik: 'SA', navodaya: 'NV', rms: 'RM', foundation: 'FD' }

// Same format tickets have always carried, so already-printed ones still match.
export const hallTicketNo = (examId, roll) => `GNSI/${examId?.toString().slice(-4).toUpperCase() || 'XXXX'}/${String(roll ?? 0).padStart(4, '0')}`

export function nextRoll(cands, examId) {
  return cands.filter(c => c.exam_id === examId).reduce((m, c) => Math.max(m, Number(c.roll_number) || 0), 0) + 1
}

// SA260001 — course code, 2-digit exam year, running number within the exam.
export function applicationNo(exam, seq) {
  const code = COURSE_CODE[exam?.course || EXAM_TYPE_COURSE[exam?.exam_type]] || 'GN'
  const yy = String(exam?.exam_date ? new Date(exam.exam_date).getFullYear() : new Date().getFullYear()).slice(-2)
  return `${code}${yy}${String(seq).padStart(4, '0')}`
}

export function nextApplicationSeq(cands, examId) {
  return cands.filter(c => c.exam_id === examId).reduce((m, c) => {
    const n = Number(String(c.application_no || '').slice(-4))
    return Math.max(m, Number.isFinite(n) ? n : 0)
  }, 0) + 1
}
