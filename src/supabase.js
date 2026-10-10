import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const client = createClient(supabaseUrl, supabaseKey)

// Anything that writes to `students` through this client tells the shared
// roster cache (studentQueries.js) to drop its copy, so the next read is fresh.
const studentWriteListeners = new Set()
export const onStudentsWrite = fn => { studentWriteListeners.add(fn); return () => studentWriteListeners.delete(fn) }
const notifyStudentsWrite = () => studentWriteListeners.forEach(fn => { try { fn() } catch { /* listener errors never block a write */ } })

const baseFrom = client.from.bind(client)
client.from = table => {
  const builder = baseFrom(table)
  if (table !== 'students') return builder
  for (const method of ['insert', 'update', 'upsert', 'delete']) {
    const original = builder[method]?.bind(builder)
    if (!original) continue
    builder[method] = (...args) => {
      const query = original(...args)
      notifyStudentsWrite()
      const then = query.then.bind(query)
      query.then = (onOk, onErr) => then(value => { notifyStudentsWrite(); return onOk ? onOk(value) : value }, onErr)
      return query
    }
  }
  return builder
}

export const supabase = client
