import { useState, useEffect } from 'react'
import { supabase } from '../core/supabase'

// Table: leave_requests (inferred from portal history)
// Substitute tracking via duty_hours table
export function useLeave() {
  const [leaves, setLeaves] = useState([])
  const [subs, setSubs] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchLeaves() {
    const { data } = await supabase
      .from('leave_requests')
      .select('*')
      .order('created_at', { ascending: false })
    setLeaves(data || [])
  }

  async function fetchSubs() {
    const { data } = await supabase
      .from('duty_hours')
      .select('*')
      .order('date', { ascending: false })
    setSubs(data || [])
  }

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchLeaves(), fetchSubs()])
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
    const sub = supabase
      .channel('leave_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leave_requests' }, fetchLeaves)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function addLeave(record) {
    const { error } = await supabase.from('leave_requests').insert(record)
    if (error) throw error
    await fetchLeaves()
  }

  async function updateLeave(id, updates) {
    const { error } = await supabase.from('leave_requests').update(updates).eq('id', id)
    if (error) throw error
    await fetchLeaves()
  }

  async function deleteLeave(id) {
    const { error } = await supabase.from('leave_requests').delete().eq('id', id)
    if (error) throw error
    await fetchLeaves()
  }

  async function addSub(record) {
    const { error } = await supabase.from('duty_hours').insert(record)
    if (error) throw error
    await fetchSubs()
  }

  async function updateSub(id, updates) {
    const { error } = await supabase.from('duty_hours').update(updates).eq('id', id)
    if (error) throw error
    await fetchSubs()
  }

  return {
    leaves, subs, loading,
    onLeavesChange: { add: addLeave, update: updateLeave, delete: deleteLeave },
    onSubsChange: { add: addSub, update: updateSub },
    refetch: fetchAll,
  }
}
