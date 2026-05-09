import { useState, useEffect } from 'react'
import { supabase } from '../core/supabase'

export function useSalary() {
  const [salaryData, setSalaryData] = useState([])
  const [advances, setAdvances] = useState([])
  const [dutyData, setDutyData] = useState([])
  const [loading, setLoading] = useState(true)

  async function fetchSalary() {
    const { data } = await supabase
      .from('salary_records')
      .select('*')
      .order('month', { ascending: false })
    setSalaryData(data || [])
  }

  async function fetchAdvances() {
    const { data } = await supabase
      .from('gnsi_fee_advance')
      .select('*')
      .order('created_at', { ascending: false })
    setAdvances(data || [])
  }

  async function fetchDuty() {
    const { data } = await supabase
      .from('duty_hours')
      .select('*')
      .order('date', { ascending: false })
    setDutyData(data || [])
  }

  async function fetchAll() {
    setLoading(true)
    await Promise.all([fetchSalary(), fetchAdvances(), fetchDuty()])
    setLoading(false)
  }

  useEffect(() => {
    fetchAll()
    const sub = supabase
      .channel('salary_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'salary_records' }, fetchSalary)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'duty_hours' }, fetchDuty)
      .subscribe()
    return () => supabase.removeChannel(sub)
  }, [])

  async function addSalary(record) {
    const { error } = await supabase.from('salary_records').insert(record)
    if (error) throw error
    await fetchSalary()
  }

  async function updateSalary(id, updates) {
    const { error } = await supabase.from('salary_records').update(updates).eq('id', id)
    if (error) throw error
    await fetchSalary()
  }

  async function addAdvance(record) {
    const { error } = await supabase.from('gnsi_fee_advance').insert(record)
    if (error) throw error
    await fetchAdvances()
  }

  async function addDuty(record) {
    const { error } = await supabase.from('duty_hours').insert(record)
    if (error) throw error
    await fetchDuty()
  }

  return {
    salaryData, advances, dutyData, loading,
    onSalaryChange: { add: addSalary, update: updateSalary },
    onAdvancesChange: { add: addAdvance },
    onDutyChange: { add: addDuty },
    refetch: fetchAll,
  }
}
