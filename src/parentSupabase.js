// Separate Supabase client for the Parents Portal.
// Parents get their own login session, stored under a different key, so a
// parent signing in on a shared office computer never replaces a staff
// member's ERP login (and vice versa).
import { createClient } from '@supabase/supabase-js'

export const parentSupabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  { auth: { storageKey: 'gnsi-parent-auth', persistSession: true, autoRefreshToken: true } }
)
