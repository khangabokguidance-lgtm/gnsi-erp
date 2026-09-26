// StudyMaterialBridge.js — GNSI Portal
// Shared cross-module data hooks for StudyMaterial, QuestionBank, StudyLockers, Teaching
// Import these hooks in any module that needs cross-module data.
//
// USAGE:
//   import { useQBankCountsByChapter, useStudyMaterialsByChapter, useMaterialCountsByChapter, useTeachingLogsByChapter } from './StudyMaterialBridge'

import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from './supabase'
import { EventBus, GNSI_EVENTS } from './EventBus'

// ── SUBJECT NAME NORMALIZER ────────────────────────────────────────────────────
// QBank uses: Mathematics, Intelligence, Language, General Knowledge
// StudyMaterial/Lockers uses: Mathematics, Intelligence, English Language,
//   General Knowledge, Social Studies, Mental Ability, Arithmetic, Hindi Language,
//   Science, English, Social Science, Hindi
//
// This map normalizes any module's subject name → QBank subject name
export const SUBJECT_TO_QBANK = {
  // Direct matches (pass-through)
  'Mathematics':         'Mathematics',
  'Intelligence':        'Intelligence',
  'General Knowledge':   'General Knowledge',
  'Language':            'Language',
  // StudyMaterial → QBank
  'English Language':    'Language',
  'Hindi Language':      'Language',
  'English':             'Language',
  'Hindi':               'Language',
  // Navodaya
  'Mental Ability':      'Intelligence',
  'Arithmetic':          'Mathematics',
  // Foundation
  'Science':             'General Knowledge',
  'Social Science':      'General Knowledge',
  'Social Studies':      'General Knowledge',
  // Navodaya — EVS added to JNVST 2027 pattern (Section 1: MAT + EVS)
  'Environmental Studies (EVS)': 'General Knowledge',
}

// Reverse: QBank subject → display subjects (for filtering)
export const QBANK_TO_SUBJECTS = {
  'Mathematics':       ['Mathematics', 'Arithmetic'],
  'Intelligence':      ['Intelligence', 'Mental Ability'],
  'Language':          ['English Language', 'Hindi Language', 'English', 'Hindi', 'Language'],
  'General Knowledge': ['General Knowledge', 'Science', 'Social Science', 'Social Studies', 'Environmental Studies (EVS)'],
}

export function normalizeToQBank(subject) {
  return SUBJECT_TO_QBANK[subject] || subject
}

// ── Paged fetch ────────────────────────────────────────────────────────────────
// Supabase/PostgREST returns at most 1000 rows per request, silently. A
// single .select() over qbank_questions (≈10k rows) therefore dropped
// everything past row 1000 without any error. buildQuery must return a
// fresh query each call (with a deterministic .order()) so pages don't
// overlap or skip. Returns { data, error }, like a normal query.
export async function fetchAllPages(buildQuery, pageSize = 1000) {
  let all = []
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1)
    if (error) return { data: null, error }
    all = all.concat(data || [])
    if (!data || data.length < pageSize) return { data: all, error: null }
  }
}

// ── CHAPTER FOCUS (Teaching hub navigation) ───────────────────────────────────
// "Open this chapter in <target module>". The old pattern —
//   onNavigate('questionbank'); EventBus.emit(NAVIGATE_TO, {...})
// — lost the chapter: the emit ran synchronously before React had mounted the
// target page, so nobody was listening and it opened unfiltered. A focus is
// now also kept as a pending value that the target takes when it mounts
// (useChapterFocus), and broadcast for a target that is already on screen.
//
// Targets: 'hub' (Teaching → Chapter Hub), 'questionbank', 'studymaterial',
// 'studylockers', 'syllabusmgr', 'logs' (Teaching → Daily Logs).
// ctx: { course, subject, chapter } using the qbankTaxonomy names.
let pendingFocus = null
const FOCUS_TTL_MS = 30 * 1000

export function focusChapter(target, ctx = {}) {
  pendingFocus = { target, course: ctx.course || '', subject: ctx.subject || '', chapter: ctx.chapter || '', at: Date.now() }
  EventBus.emit(GNSI_EVENTS.CHAPTER_FOCUS, pendingFocus)
}

// Focus + navigate in one call. `navigate` is the module's onNavigate
// (App page switch, or the Teaching hub's tab switch when embedded).
export function openChapterIn(target, ctx, navigate) {
  focusChapter(target, ctx)
  navigate?.(target)
}

export function takeChapterFocus(target) {
  if (pendingFocus && pendingFocus.target === target && Date.now() - pendingFocus.at < FOCUS_TTL_MS) {
    const f = pendingFocus
    pendingFocus = null
    return f
  }
  return null
}

// Calls onFocus(ctx) with a focus meant for `target` — once on mount if one
// is pending, and again whenever a new one arrives while mounted.
export function useChapterFocus(target, onFocus) {
  const cb = useRef(onFocus)
  useEffect(() => { cb.current = onFocus })
  useEffect(() => {
    const f = takeChapterFocus(target)
    if (f) cb.current(f)
    return EventBus.on(GNSI_EVENTS.CHAPTER_FOCUS, f2 => {
      if (f2?.target !== target) return
      takeChapterFocus(target)
      cb.current(f2)
    })
  }, [target])
}

// ── HOOK: Q-Bank question counts by chapter ────────────────────────────────────
// Returns: { counts: { [chapter]: number }, loading, refetch }
// Use in StudyMaterial to show Q badges on chapter rows.
export function useQBankCountsByChapter(subject) {
  const [counts,  setCounts]  = useState({})
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!subject) { setCounts({}); return }
    setLoading(true)
    const qbankSubject = normalizeToQBank(subject)
    const { data, error } = await fetchAllPages(() => supabase
      .from('qbank_questions')
      .select('chapter')
      .eq('subject', qbankSubject)
      .order('id', { ascending: true }))
    if (!error && data) {
      const map = {}
      data.forEach(r => { map[r.chapter] = (map[r.chapter] || 0) + 1 })
      setCounts(map)
    }
    setLoading(false)
  }, [subject])

  useEffect(() => { fetch() }, [fetch])

  // Re-fetch when QBank saves a question (EventBus signal)
  useEffect(() => {
    const unsub = EventBus.on(GNSI_EVENTS.QUESTION_SAVED, fetch)
    return unsub
  }, [fetch])

  return { counts, loading, refetch: fetch }
}

// ── HOOK: Study materials by chapter ──────────────────────────────────────────
// Returns: { materials: StudyMaterial[], loading, refetch }
// Use in QuestionBank to show reference materials when a chapter is selected.
export function useStudyMaterialsByChapter(subject, chapter) {
  const [materials, setMaterials] = useState([])
  const [loading,   setLoading]   = useState(false)

  const fetch = useCallback(async () => {
    if (!subject || !chapter) { setMaterials([]); return }
    setLoading(true)
    // Match by chapter across all subject name variants
    const subjectVariants = Object.entries(SUBJECT_TO_QBANK)
      .filter(([, v]) => v === normalizeToQBank(subject))
      .map(([k]) => k)
    const uniqueVariants = [...new Set([subject, ...subjectVariants])]

    const { data, error } = await supabase
      .from('study_materials')
      .select('id, title, material_type, file_url, chapter, subject, course')
      .in('subject', uniqueVariants)
      .eq('chapter', chapter)
      .order('created_at', { ascending: false })
      .limit(8)
    if (!error && data) setMaterials(data)
    setLoading(false)
  }, [subject, chapter])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    const unsub = EventBus.on(GNSI_EVENTS.MATERIAL_SAVED, fetch)
    return unsub
  }, [fetch])

  return { materials, loading, refetch: fetch }
}

// ── HOOK: Study material counts by chapter (bulk) ─────────────────────────────
// Returns: { counts: { [chapter]: number }, loading, refetch }
// Bulk counterpart to useStudyMaterialsByChapter — one query per subject
// instead of per chapter, so a chapter-list render loop (e.g. QuestionBank's
// Stats tab) can show a materials count next to each chapter's question
// count without calling a per-chapter hook inside a .map() (which would
// break the rules of hooks). Mirrors useQBankCountsByChapter's shape
// exactly so both "N questions" and "N materials" badges can sit side by
// side using the same counts[chapter] pattern.
export function useMaterialCountsByChapter(subject) {
  const [counts,  setCounts]  = useState({})
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!subject) { setCounts({}); return }
    setLoading(true)
    // Match across all subject-name variants, same as useStudyMaterialsByChapter,
    // since study_materials is keyed by each module's own rich subject names
    // (English Language, Arithmetic, etc.) rather than QBank's four buckets.
    const subjectVariants = Object.entries(SUBJECT_TO_QBANK)
      .filter(([, v]) => v === normalizeToQBank(subject))
      .map(([k]) => k)
    const uniqueVariants = [...new Set([subject, ...subjectVariants])]

    const { data, error } = await supabase
      .from('study_materials')
      .select('chapter')
      .in('subject', uniqueVariants)
    if (!error && data) {
      const map = {}
      data.forEach(r => { if (r.chapter) map[r.chapter] = (map[r.chapter] || 0) + 1 })
      setCounts(map)
    }
    setLoading(false)
  }, [subject])

  useEffect(() => { fetch() }, [fetch])

  useEffect(() => {
    const unsub = EventBus.on(GNSI_EVENTS.MATERIAL_SAVED, fetch)
    return unsub
  }, [fetch])

  return { counts, loading, refetch: fetch }
}

// ── HOOK: Teaching log counts by chapter ──────────────────────────────────────
// Returns: { counts: { [chapter]: number }, loading }
// Use in StudyMaterial Stats to show teaching activity per chapter.
export function useTeachingLogsByChapter(subject, course) {
  const [counts,  setCounts]  = useState({})
  const [loading, setLoading] = useState(false)

  const fetch = useCallback(async () => {
    if (!subject) { setCounts({}); return }
    setLoading(true)
    let q = supabase.from('teaching_logs').select('topic_taught, subject_name')
    if (subject) q = q.eq('subject_name', subject)
    if (course)  q = q.eq('course', course)
    const { data, error } = await q.limit(500)
    if (!error && data) {
      // teaching_logs has topic_taught, not chapter — count by topic as proxy
      const map = {}
      data.forEach(r => {
        if (r.topic_taught) map[r.topic_taught] = (map[r.topic_taught] || 0) + 1
      })
      setCounts(map)
    }
    setLoading(false)
  }, [subject, course])

  useEffect(() => { fetch() }, [fetch])

  return { counts, loading }
}

// ── GNSI_EVENTS extensions ─────────────────────────────────────────────────────
// Add these to your EventBus.js GNSI_EVENTS constant if not already present:
//
//   MATERIAL_SAVED:  'gnsi:material_saved'
//   QUESTION_SAVED:  'gnsi:question_saved'
//   LOCKER_UNLOCKED: 'gnsi:locker_unlocked'
//   NAVIGATE_TO:     'gnsi:navigate_to'   // payload: { module, params }
//
// EventBus.emit(GNSI_EVENTS.MATERIAL_SAVED)   → in BulkPasteModal after insert
// EventBus.emit(GNSI_EVENTS.QUESTION_SAVED)   → in TabManualAdd / TabBulkPaste after insert
// EventBus.emit(GNSI_EVENTS.NAVIGATE_TO, { module: 'questionbank', params: { subject, chapter } })

export const BRIDGE_EVENTS = {
  MATERIAL_SAVED:  'gnsi:material_saved',
  QUESTION_SAVED:  'gnsi:question_saved',
  LOCKER_UNLOCKED: 'gnsi:locker_unlocked',
  NAVIGATE_TO:     'gnsi:navigate_to',
}