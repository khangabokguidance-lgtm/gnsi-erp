import { useState, useEffect } from 'react'
import { supabase } from '../core/supabase'

export function useConnect() {
  const [connectData, setConnectData] = useState({
    feedback: [],
    meetings: [],
    events: [],
    books: [],
    issues: [],
  })
  const [loading, setLoading] = useState(true)

  async function fetch() {
    setLoading(true)
    // Use gnsi_keyvalue as flexible store for connect module data
    const { data } = await supabase
      .from('gnsi_keyvalue')
      .select('*')
      .in('key', ['connect_feedback', 'connect_meetings', 'connect_events', 'connect_books', 'connect_issues'])

    const map = {}
    ;(data || []).forEach(row => {
      try { map[row.key] = JSON.parse(row.value) } catch { map[row.key] = [] }
    })

    setConnectData({
      feedback: map['connect_feedback'] || [],
      meetings: map['connect_meetings'] || [],
      events: map['connect_events'] || [],
      books: map['connect_books'] || [],
      issues: map['connect_issues'] || [],
    })
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  async function onDataChange(newData) {
    setConnectData(newData) // optimistic update

    // Persist each changed key back to gnsi_keyvalue
    const entries = [
      { key: 'connect_feedback', value: JSON.stringify(newData.feedback || []) },
      { key: 'connect_meetings', value: JSON.stringify(newData.meetings || []) },
      { key: 'connect_events', value: JSON.stringify(newData.events || []) },
      { key: 'connect_books', value: JSON.stringify(newData.books || []) },
      { key: 'connect_issues', value: JSON.stringify(newData.issues || []) },
    ]

    for (const entry of entries) {
      await supabase.from('gnsi_keyvalue').upsert(entry, { onConflict: 'key' })
    }
  }

  return { connectData, loading, onDataChange, refetch: fetch }
}
