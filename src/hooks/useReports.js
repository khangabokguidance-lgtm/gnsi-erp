import { useState, useEffect } from 'react'
import { supabase } from '../core/supabase'

export function useReports() {
  const [reportData, setReportData] = useState({
    appraisals: [],
    attendance: {},
  })
  const [loading, setLoading] = useState(true)

  async function fetch() {
    setLoading(true)
    const [appraisals, attendance] = await Promise.all([
      supabase.from('gnsi_reports').select('*').order('created_at', { ascending: false }),
      supabase.from('v_attendance_monthly').select('*').limit(500),
    ])
    setReportData({
      appraisals: appraisals.data || [],
      attendance: attendance.data || {},
    })
    setLoading(false)
  }

  useEffect(() => { fetch() }, [])

  return { reportData, loading, refetch: fetch }
}
