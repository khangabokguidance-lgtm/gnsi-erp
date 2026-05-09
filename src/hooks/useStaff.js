import { useState, useEffect } from 'react'
import { supabase } from '../core/supabase'

export function useStaff() {
  const [staff, setStaff] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function fetch() {
    setLoading(true)
    const { data, error } = await supabase
      .from('staff_auth')
      .select(`
        *,
        gnsi_staff_biodata (*)
      `)
      .order('name')
    if (error) setError(error.message)
    else setStaff(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetch()
    const sub = supabase
      .channel('staff_auth_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_auth' }, fetch)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function addStaff(record) {
    const { error } = await supabase.from('staff_auth').insert(record)
    if (error) throw error
    await fetch()
  }

  async function updateStaff(id, updates) {
    const { error } = await supabase.from('staff_auth').update(updates).eq('id', id)
    if (error) throw error
    await fetch()
  }

  async function deleteStaff(id) {
    const { error } = await supabase.from('staff_auth').delete().eq('id', id)
    if (error) throw error
    await fetch()
  }

  return { staff, loading, error, addStaff, updateStaff, deleteStaff, refetch: fetch }
}
