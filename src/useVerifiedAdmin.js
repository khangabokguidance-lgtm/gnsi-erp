// useVerifiedAdmin.js — don't trust the browser for "am I an admin?".
// The role in localStorage can be edited by anyone. This asks the database
// (qbank_is_admin(), which reads the role from the staff table for the real
// login) and only keeps admin screens open when the server agrees. If the
// check can't be made (function not installed, offline), it falls back to the
// local role so the app keeps working — the database triggers still block
// unauthorised writes either way.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'

export function useVerifiedAdmin(localIsAdmin) {
  const [server, setServer] = useState(null)   // null = not checked / unknown
  useEffect(() => {
    if (!localIsAdmin) return
    let live = true
    // Without a secure session the server can't tell who this is (it would answer
    // "not admin" for a real admin) — in that case don't demote anyone.
    supabase.auth.getSession()
      .then(({ data }) => (data?.session ? supabase.rpc('qbank_is_admin') : { data: null, error: true }))
      .then(({ data, error }) => { if (live) setServer(error ? null : data === true) })
      .catch(() => { if (live) setServer(null) })
    return () => { live = false }
  }, [localIsAdmin])
  return !!localIsAdmin && server !== false
}
