import { useState, useEffect } from 'react'
import { supabase } from '../core/supabase'

export function useStudents() {
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetch() {
    setLoading(true)
    const { data } = await supabase
      .from('students')
      .select('*')
      .order('name')
    setStudents(data || [])
    setLoading(false)
  }

  useEffect(() => {
    fetch()
    const sub = supabase
      .channel('students_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'students' }, fetch)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  return { students, loading, refetch: fetch }
}
