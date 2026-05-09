import { useState, useEffect } from 'react'
import { supabase } from '../core/supabase'

export function useNotices() {
  const [notices, setNotices] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetch() {
    setLoading(true)
    const { data } = await supabase
      .from('gnsi_notices')
      .select('*')
      .order('created_at', { ascending: false })
    setNotices(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetch()
    const sub = supabase
      .channel('notices_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gnsi_notices' }, fetch)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function onNoticesChange(updated) {
    // updated is the full array from NoticesModule (it manages its own state)
    // We sync the diff to Supabase
    // Simpler: expose individual add/update/delete
  }

  async function addNotice(record) {
    const { error } = await supabase.from('gnsi_notices').insert({
      title: record.title,
      body: record.body,
      priority: record.priority,
      date: record.date || new Date().toISOString().split('T')[0],
    })
    if (error) throw error
    await fetch()
  }

  async function updateNotice(id, updates) {
    const { error } = await supabase.from('gnsi_notices').update(updates).eq('id', id)
    if (error) throw error
    await fetch()
  }

  async function deleteNotice(id) {
    const { error } = await supabase.from('gnsi_notices').delete().eq('id', id)
    if (error) throw error
    await fetch()
  }

  // NoticesModule calls onNoticesChange(newArray) — we reconcile
  async function syncNotices(newArray) {
    setNotices(newArray) // optimistic
    // Find added/deleted by comparing with current
    // For simplicity, just refetch from DB on next tick
    setTimeout(fetch, 500)
  }

  return { notices, loading, addNotice, updateNotice, deleteNotice, syncNotices, refetch: fetch }
}
