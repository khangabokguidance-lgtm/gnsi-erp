// shared/useActiveSession.js
// ─────────────────────────────────────────────────────────────────────────────
//  Hook: fetches the currently active admission session.
//  Used in Admissions.jsx to auto-assign session and enforce lock.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { supabase } from '../supabase.js'

export function useActiveSession() {
  const [session, setSession]   = useState(null)
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    supabase
      .from('admission_sessions')
      .select('*')
      .eq('is_active', true)
      .single()
      .then(({ data }) => {
        setSession(data || null)
        setLoading(false)
      })
  }, [])

  return { session, loading }
}