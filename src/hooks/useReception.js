import { useState, useEffect } from 'react'
import { supabase } from '../core/supabase'

export function useReception() {
  const [receptionData, setReceptionData] = useState({ enquiries: [], log: [] })
  const [loading, setLoading] = useState(true)

  async function fetch() {
    setLoading(true)
    const [enquiries, log] = await Promise.all([
      supabase.from('reception_enquiries').select('*').order('created_at', { ascending: false }),
      supabase.from('reception_log').select('*').order('created_at', { ascending: false }),
    ])
    setReceptionData({
      enquiries: enquiries.data || [],
      log: log.data || [],
    })
    setLoading(false)
  }

  useEffect(() => {
    fetch()
    const sub = supabase
      .channel('reception_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reception_enquiries' }, fetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reception_log' }, fetch)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function onDataChange(newData) {
    setReceptionData(newData) // optimistic
    // Sync individual records as needed
    setTimeout(fetch, 500)
  }

  async function addEnquiry(record) {
    const { error } = await supabase.from('reception_enquiries').insert(record)
    if (error) throw error
    await fetch()
  }

  async function addLog(record) {
    const { error } = await supabase.from('reception_log').insert(record)
    if (error) throw error
    await fetch()
  }

  return { receptionData, loading, onDataChange, addEnquiry, addLog, refetch: fetch }
}
