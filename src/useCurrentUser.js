// useCurrentUser.js
// ─── Single source of truth for "who is logged in" ───────────────────────────
// Usage in any component:
//   import { useCurrentUser } from './useCurrentUser'
//   const { currentUser, userLoading } = useCurrentUser()
//
// currentUser is the matching staff_profiles row, with these fields:
//   id, name, email, role, department, designation, status, phone, etc.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from 'react'
import { supabase } from './supabase'
import { staffDB } from './staffDB'

export function useCurrentUser() {
  const [currentUser, setCurrentUser] = useState(null)
  const [userLoading, setUserLoading] = useState(true)
  const [authUser,    setAuthUser]    = useState(null)

  useEffect(() => {
    async function load() {
      try {
        // 1. Get Supabase auth session
        const { data: { user }, error } = await supabase.auth.getUser()
        if (error || !user) { setUserLoading(false); return }

        setAuthUser(user)

        // 2. Match against staff_profiles by email
        const all   = await staffDB.getAll()
        const match = all.find(s =>
          s.email?.toLowerCase().trim() === user.email?.toLowerCase().trim()
        )

        setCurrentUser(match || null)
      } catch (e) {
        console.error('useCurrentUser error:', e)
      } finally {
        setUserLoading(false)
      }
    }

    load()

    // 3. Re-run if auth state changes (login / logout / token refresh)
    const { data: listener } = supabase.auth.onAuthStateChange(() => load())
    return () => listener.subscription.unsubscribe()
  }, [])

  // Convenience flags — use these directly in components
  const isAdmin       = currentUser?.role === 'Admin' || currentUser?.role === 'Teaching + Admin'
  const isTeaching    = currentUser?.role === 'Teaching' || currentUser?.role === 'Teaching + Admin'
  const isNonTeaching = currentUser?.role === 'Non-Teaching'
  const canManage     = isAdmin

  return {
    currentUser,   // full staff_profiles row
    userLoading,
    authUser,      // raw Supabase auth user (has .id, .email, .user_metadata)
    isAdmin,
    isTeaching,
    isNonTeaching,
    canManage,
  }
}