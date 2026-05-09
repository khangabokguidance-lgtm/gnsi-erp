import { useState, useEffect } from 'react'
import { supabase } from '../core/supabase'

export function useTeaching() {
  const [teachingData, setTeachingData] = useState({
    attendance: [],
    periods: [],
    plans: [],
  })
  const [loading, setLoading] = useState(true)

  async function fetch() {
    setLoading(true)
    const [attendance, periods] = await Promise.all([
      supabase.from('attendance_periods').select('*').order('date', { ascending: false }).limit(200),
      supabase.from('period_attendance').select('*').order('date', { ascending: false }).limit(200),
    ])
    setTeachingData({
      attendance: attendance.data || [],
      periods: periods.data || [],
      plans: [],
    })
    setLoading(false)
  }

  useEffect(() => {
    fetch()
    const sub = supabase
      .channel('teaching_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_periods' }, fetch)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function onDataChange(newData) {
    setTeachingData(newData)
    setTimeout(fetch, 500)
  }

  async function saveAttendance(record) {
    const { error } = await supabase.from('period_attendance').upsert(record)
    if (error) throw error
    await fetch()
  }

  return { teachingData, loading, onDataChange, saveAttendance, refetch: fetch }
}
