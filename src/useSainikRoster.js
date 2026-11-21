// useSainikRoster.js — loads the Mission Sainik student roster (every Sainik student + the Combined course) once per screen.
// Shared by Students, Admit cards, Mock marks and Certificates.
import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { getActiveStudents } from './studentQueries'
import { sainikRoster } from './lib/missionSainikStudents'

const PHOTO_BUCKET = 'gnsi'

// Students keep photos in private storage (photo_path); turn them into temporary viewing links, in memory only.
export async function withPhotoLinks(rows) {
  const need = rows.filter(r => r.photoPath && !r.photo)
  if (!need.length) return rows
  try {
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(need.map(r => r.photoPath), 86400)
    if (error || !data) return rows
    const by = new Map(data.filter(d => d.signedUrl).map(d => [d.path, d.signedUrl]))
    return rows.map(r => (r.photoPath && !r.photo && by.get(r.photoPath) ? { ...r, photo: by.get(r.photoPath) } : r))
  } catch { return rows }
}

export async function loadSainikRoster({ photos = true } = {}) {
  let rows = null
  try { rows = await getActiveStudents('id,name,gcc_no,admission_no,phone,course,batch,class_name,status,photo_url,photo_path') } catch { rows = null }
  if (!rows || !rows.length) { try { rows = await getActiveStudents('id,name,gcc_no,admission_no,phone,course,batch,class_name,status') } catch { rows = [] } }   // a database without the photo columns
  const list = sainikRoster(rows || [])
  return photos ? withPhotoLinks(list) : list
}

// null while loading, then the roster.
export function useSainikRoster(opts) {
  const [roster, setRoster] = useState(null)
  useEffect(() => {
    let live = true
    loadSainikRoster(opts).then(r => { if (live) setRoster(r) })
    return () => { live = false }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return roster
}
