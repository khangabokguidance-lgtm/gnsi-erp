import { useState, useEffect } from 'react'
import { supabase } from '../core/supabase'

export function useHR() {
  const [appraisals, setAppraisals] = useState([])
  const [grievances, setGrievances] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchAppraisals() {
    const { data } = await supabase
      .from('gnsi_staff_credentials')
      .select('*')
      .order('created_at', { ascending: false })
    setAppraisals(data || [])
  }

  async function fetchGrievances() {
    const { data } = await supabase
      .from('student_concerns')   // closest match — or create grievances table
      .select('*')
      .order('created_at', { ascending: false })
    setGrievances(data || [])
  }

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchAppraisals(), fetchGrievances()])
    setLoading(false)
  }

  useEffect(() => { fetchAll() }, [])

  async function addAppraisal(record) {
    const { error } = await supabase.from('gnsi_staff_credentials').insert(record)
    if (error) throw error
    await fetchAppraisals()
  }

  async function updateAppraisal(id, updates) {
    const { error } = await supabase.from('gnsi_staff_credentials').update(updates).eq('id', id)
    if (error) throw error
    await fetchAppraisals()
  }

  async function addGrievance(record) {
    const { error } = await supabase.from('student_concerns').insert(record)
    if (error) throw error
    await fetchGrievances()
  }

  async function updateGrievance(id, updates) {
    const { error } = await supabase.from('student_concerns').update(updates).eq('id', id)
    if (error) throw error
    await fetchGrievances()
  }

  return {
    appraisals, grievances, loading,
    onAppraisalsChange: { add: addAppraisal, update: updateAppraisal },
    onGrievancesChange: { add: addGrievance, update: updateGrievance },
    refetch: fetchAll,
  }
}
