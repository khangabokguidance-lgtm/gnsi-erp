// enhancerHooks.js — Supabase data for Study Materials → Teaching Enhancer.
// Every hook reports `available: false` (instead of throwing) when the
// tables from supabase/migrations/20260927_teaching_enhancer.sql haven't
// been created yet, so the page can show a notice and keep working.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { fetchAllPages, normalizeToQBank } from './StudyMaterialBridge'
import { aggregateFeedback, isMissingTable, planRow } from './enhancerCore'

// Email of the Supabase Auth session (staff sessions are linked at login).
// Rows are keyed on it, and RLS lets staff edit only their own rows.
export function useAuthEmail() {
  const [email, setEmail] = useState('')
  useEffect(() => {
    let live = true
    supabase.auth.getSession().then(({ data }) => { if (live) setEmail((data?.session?.user?.email || '').toLowerCase()) }).catch(() => {})
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setEmail((session?.user?.email || '').toLowerCase()))
    return () => { live = false; sub?.subscription?.unsubscribe?.() }
  }, [])
  return email
}

// Ratings + bookmarks for every material.
export function useMaterialFeedback(authorName) {
  const email = useAuthEmail()
  const [rows, setRows] = useState([])
  const [available, setAvailable] = useState(true)

  const reload = useCallback(async () => {
    const { data, error } = await fetchAllPages(() => supabase.from('study_material_feedback').select('*').order('id', { ascending: true }))
    if (error) { if (isMissingTable(error)) setAvailable(false); return }
    setAvailable(true)
    setRows(data || [])
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads feedback from the server on open
  useEffect(() => { reload() }, [reload])

  const byId = aggregateFeedback(rows, email)

  const save = useCallback(async (materialId, patch) => {
    if (!email) return { error: { message: 'Your login is not linked to a staff session, so ratings can’t be saved. Sign out and in again.' } }
    const id = String(materialId)
    const mine = rows.find(r => String(r.material_id) === id && String(r.author_email || '').toLowerCase() === email)
    const next = { material_id: id, author_email: email, author_name: authorName || null, rating: mine?.rating ?? null, bookmarked: mine?.bookmarked ?? false, ...patch, updated_at: new Date().toISOString() }
    // Optimistic: show the change at once, roll back on error.
    setRows(prev => [...prev.filter(r => r !== mine), next])
    const { error } = await supabase.from('study_material_feedback').upsert(next, { onConflict: 'material_id,author_email' })
    if (error) { setRows(prev => [...prev.filter(r => r !== next), ...(mine ? [mine] : [])]); return { error } }
    return { error: null }
  }, [email, rows, authorName])

  return {
    available, byId, email, reload,
    rate: (id, rating) => save(id, { rating }),
    toggleBookmark: id => save(id, { bookmarked: !byId[String(id)]?.bookmarked }),
  }
}

export function useLessonPlans() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(true)
  const reload = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('teaching_lesson_plans').select('*').order('updated_at', { ascending: false }).limit(500)
    if (error) { if (isMissingTable(error)) setAvailable(false) } else { setAvailable(true); setPlans(data || []) }
    setLoading(false)
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads plans from the server on open
  useEffect(() => { reload() }, [reload])

  const save = useCallback(async plan => {
    const row = { ...planRow(plan), updated_at: new Date().toISOString() }
    const q = plan.id
      ? supabase.from('teaching_lesson_plans').update(row).eq('id', plan.id).select().single()
      : supabase.from('teaching_lesson_plans').insert(row).select().single()
    const { data, error } = await q
    if (!error) setPlans(prev => [data, ...prev.filter(p => p.id !== data.id)])
    return { data, error }
  }, [])

  const remove = useCallback(async id => {
    const { error } = await supabase.from('teaching_lesson_plans').delete().eq('id', id)
    if (!error) setPlans(prev => prev.filter(p => p.id !== id))
    return { error }
  }, [])

  return { plans, loading, available, reload, save, remove }
}

export function useMaterialRequests() {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [available, setAvailable] = useState(true)
  const reload = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('study_material_requests').select('*').order('created_at', { ascending: false }).limit(500)
    if (error) { if (isMissingTable(error)) setAvailable(false) } else { setAvailable(true); setRequests(data || []) }
    setLoading(false)
  }, [])
  // eslint-disable-next-line react-hooks/set-state-in-effect -- loads requests from the server on open
  useEffect(() => { reload() }, [reload])

  const create = useCallback(async req => {
    const { data, error } = await supabase.from('study_material_requests').insert(req).select().single()
    if (!error) setRequests(prev => [data, ...prev])
    return { data, error }
  }, [])
  const update = useCallback(async (id, patch) => {
    const { data, error } = await supabase.from('study_material_requests').update(patch).eq('id', id).select().single()
    if (!error) setRequests(prev => prev.map(r => (r.id === id ? data : r)))
    return { data, error }
  }, [])
  const remove = useCallback(async id => {
    const { error } = await supabase.from('study_material_requests').delete().eq('id', id)
    if (!error) setRequests(prev => prev.filter(r => r.id !== id))
    return { error }
  }, [])

  return { requests, loading, available, reload, create, update, remove }
}

// Question Bank questions for one chapter (for the quick quiz).
export async function fetchChapterQuestions(subject, chapter) {
  if (!subject || !chapter) return []
  const { data, error } = await fetchAllPages(() => supabase.from('qbank_questions')
    .select('id, question, option_a, option_b, option_c, option_d, correct_option, difficulty, subsection, chapter, subject')
    .eq('subject', normalizeToQBank(subject)).eq('chapter', chapter).order('id', { ascending: true }))
  return error ? [] : (data || [])
}
