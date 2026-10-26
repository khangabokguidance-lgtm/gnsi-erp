// Shared helpers for the Exams module: remembered batch/exam selection,
// non-blocking dialogs (replacing alert/confirm) and URL-safe mark fetching.
import { useState, useCallback } from 'react'

// ── Remembered selection ────────────────────────────────────────────────────
// Every tool used to start on "first batch / oldest exam". Now they all open on
// whatever you last picked, and a fresh start defaults to the NEWEST exam type.
const SEL_KEY = 'gnsi_exam_sel'
const readSel = () => { try { return JSON.parse(localStorage.getItem(SEL_KEY) || '{}') } catch { return {} } }
const writeSel = patch => { try { localStorage.setItem(SEL_KEY, JSON.stringify({ ...readSel(), ...patch })) } catch { /* private mode */ } }

export function useExamSelection(courses, examTypes, initialCourse, initialExamType) {
  const [course, setCourseRaw] = useState(() => {
    const s = readSel().course
    return initialCourse || (courses.includes(s) ? s : courses[0] || '')
  })
  const [examType, setExamTypeRaw] = useState(() => {
    const s = readSel().examType
    return initialExamType || (examTypes.some(e => e.id === s) ? s : examTypes[examTypes.length - 1]?.id || '')
  })
  const setCourse = useCallback(v => { setCourseRaw(v); if (v) writeSel({ course: v }) }, [])
  const setExamType = useCallback(v => { setExamTypeRaw(v); if (v) writeSel({ examType: v }) }, [])
  return [course, setCourse, examType, setExamType]
}

// ── Dialog bus (host lives in ExamDialogs.jsx) ──────────────────────────────
const listeners = new Set()
export const dialogBus = { on: fn => { listeners.add(fn); return () => listeners.delete(fn) } }
const emit = ev => listeners.forEach(fn => fn(ev))

/** Resolves true/false. Falls back to the browser dialog if no host is mounted. */
export function askConfirm(message, { confirmLabel = 'Continue', danger = false } = {}) {
  if (!listeners.size) return Promise.resolve(window.confirm(message))
  return new Promise(resolve => emit({ type: 'confirm', message, confirmLabel, danger, resolve }))
}
/** Non-blocking toast. kind: info | ok | warn | error */
export function notify(message, kind = 'info') {
  if (!listeners.size) { window.alert(message); return }
  emit({ type: 'toast', message, kind, id: Math.random().toString(36).slice(2) })
}

// ── Mark fetching that cannot overflow the request URL ──────────────────────
// .in('student_id', [...hundreds of uuids]) goes in the query string; a big
// batch can exceed the limit and fail. This splits the ids into chunks.
export async function fetchMarksChunked(supabase, ids, examIds, { cols = 'student_id, exam_id, marks_obtained', match = {}, size = 80 } = {}) {
  const list = ids && ids.length ? ids : []
  if (!list.length || !examIds?.length) return { data: [], error: null }
  const parts = []
  for (let i = 0; i < list.length; i += size) parts.push(list.slice(i, i + size))
  const results = await Promise.all(parts.map(chunk => {
    let q = supabase.from('exam_marks').select(cols).in('student_id', chunk).in('exam_id', examIds)
    Object.entries(match).forEach(([k, v]) => { q = q.eq(k, v) })
    return q
  }))
  const error = results.find(r => r.error)?.error || null
  return { data: results.flatMap(r => r.data || []), error }
}
