import { supabase } from './supabase'

// fetch() for our own /api endpoints: attaches the signed-in user's access token so the server can
// verify who is calling. Falls back to a plain request when nobody is signed in (public endpoints).
export async function authFetch(url, opts = {}) {
  let token = ''
  try { token = (await supabase.auth.getSession())?.data?.session?.access_token || '' } catch { /* no session */ }
  const headers = { ...(opts.headers || {}) }
  if (token) headers.Authorization = `Bearer ${token}`
  return fetch(url, { ...opts, headers })
}
