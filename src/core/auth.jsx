import { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

// SHA-256 hash function (browser native)
export async function sha256(message) {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('gnsi_session') || 'null')
      if (saved && saved.id) setUser(saved)
    } catch(e) {}
    setLoading(false)
  }, [])

  const login = async (username, password) => {
    const hash = await sha256(password)
    const { data, error } = await supabase
      .from('portal_users')
      .select('*')
      .eq('username', username.toLowerCase().trim())
      .eq('password_hash', hash)
      .eq('active', true)
      .single()

    if (error || !data) return { error: { message: 'Invalid username or password' } }

    const sessionUser = {
      id: data.id,
      username: data.username,
      name: data.name,
      role: data.role,
      staffRole: data.staff_role,
    }
    localStorage.setItem('gnsi_session', JSON.stringify(sessionUser))
    setUser(sessionUser)
    return { data: sessionUser }
  }

  const logout = () => {
    localStorage.removeItem('gnsi_session')
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
