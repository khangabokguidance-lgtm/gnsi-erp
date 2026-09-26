// entranceHooks.js — hooks and constants shared by the Entrance tabs.

import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export function useIsMobile() {
  const [m, setM] = useState(() => window.innerWidth < 640)
  useEffect(() => {
    const h = () => setM(window.innerWidth < 640)
    window.addEventListener('resize', h)
    return () => window.removeEventListener('resize', h)
  }, [])
  return m
}

export const STATUS_TONE = {
  Scheduled: 'navy', Ongoing: 'warn', Completed: 'ok', Cancelled: 'bad',
  Registered: 'grey', 'Hall Ticket Issued': 'gold', Appeared: 'teal', Absent: 'warn', Disqualified: 'bad',
  Pending: 'grey', Pass: 'ok', Fail: 'bad', Waitlist: 'warn', Admitted: 'teal', Rejected: 'bad',
  Paid: 'ok', Unpaid: 'bad', Waived: 'grey',
}

// Manual answer key rows (papers set outside the Question Bank).
export function useManualKeys(examId, version = 0) {
  const [state, setState] = useState({ examId: null, rows: [] })
  useEffect(() => {
    let live = true
    supabase.from('entrance_answer_keys').select('*').eq('exam_id', examId).then(({ data }) => { if (live) setState({ examId, rows: data || [] }) })
    return () => { live = false }
  }, [examId, version])
  return state.examId === examId ? state.rows : null
}
