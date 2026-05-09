import { useState, useEffect } from 'react'
import { supabase } from '../core/supabase'

export function useTimetable() {
  const [timetableData, setTimetableData] = useState({
    sessions: [],
    entries: [],
    periods: [],
    columns: [],
    cells: [],
    doubt: [],
  })
  const [loading, setLoading] = useState(true)

  async function fetch() {
    setLoading(true)
    const [sessions, entries, periods, columns, cells, doubt] = await Promise.all([
      supabase.from('timetable_sessions').select('*'),
      supabase.from('timetable_entries').select('*'),
      supabase.from('timetable_periods').select('*').order('period_number'),
      supabase.from('timetable_columns').select('*'),
      supabase.from('timetable_cells').select('*'),
      supabase.from('doubt_timetable').select('*').order('created_at', { ascending: false }),
    ])
    setTimetableData({
      sessions: sessions.data || [],
      entries: entries.data || [],
      periods: periods.data || [],
      columns: columns.data || [],
      cells: cells.data || [],
      doubt: doubt.data || [],
    })
    setLoading(false)
  }

  useEffect(() => {
    fetch()
    const sub = supabase
      .channel('timetable_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timetable_cells' }, fetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'timetable_entries' }, fetch)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function onTimetableChange(newData) {
    setTimetableData(newData) // optimistic
    setTimeout(fetch, 500)
  }

  async function upsertCell(record) {
    const { error } = await supabase.from('timetable_cells').upsert(record)
    if (error) throw error
    await fetch()
  }

  async function upsertEntry(record) {
    const { error } = await supabase.from('timetable_entries').upsert(record)
    if (error) throw error
    await fetch()
  }

  return { timetableData, loading, onTimetableChange, upsertCell, upsertEntry, refetch: fetch }
}
