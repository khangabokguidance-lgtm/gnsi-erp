import { useEffect, useRef } from 'react'
import { supabase } from './supabase'
import { getAllStudents } from './studentQueries'
import { loadAll } from './lib/mockTestStore'
import { gccDigits, normName, nameCompat } from './lib/mockTestEngine'

// Certificate Maker (Design Studio) — portal bridge
// ─────────────────────────────────────────────────────────────────────────────
// The maker itself is a self-contained page: public/design-studio/certificate-maker.html.
// It also works on its own (PDF / Excel upload). Inside the portal this wrapper
// feeds it real data over postMessage:
//   • the list of mock tests stored by the Mock Analyzer (mock_test_results)
//   • one test's results, matched to students by GCC No., then by name
//   • photos (students.photo_url, or a signed link for photo_path in the
//     private 'gnsi' bucket) and parent phone numbers for WhatsApp
// Read-only: nothing is written back to the database.
//
// Messages (iframe → portal):  gnsi-cert:hello | gnsi-cert:load-test {key} |
//                              gnsi-cert:match {names:[{i,name,gcc}]}
// Messages (portal → iframe):  gnsi-cert:portal | gnsi-cert:test | gnsi-cert:matched | gnsi-cert:error

const FILE = '/design-studio/certificate-maker.html'
const PHOTO_BUCKET = 'gnsi'
const PHOTO_URL_TTL = 3600 // seconds — the maker turns photos into embedded images right away
const testKey = r => `${r.series}|${r.test_no}|${r.batch}`

async function signPhotos(students) {
  const need = students.filter(s => s.photo_path && !s.photo_url)
  if (!need.length) return students
  const byPath = new Map()
  for (let i = 0; i < need.length; i += 100) {
    try {
      const { data } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(need.slice(i, i + 100).map(s => s.photo_path), PHOTO_URL_TTL)
      ;(data || []).forEach(d => { if (d.signedUrl) byPath.set(d.path, d.signedUrl) })
    } catch { /* photos are optional */ }
  }
  return students.map(s => (s.photo_path && !s.photo_url && byPath.get(s.photo_path)) ? { ...s, photo_url: byPath.get(s.photo_path) } : s)
}

// GCC No. first; then exact name; then a unique fuzzy name match (same rules as the Mock Analyzer).
function makeMatcher(students) {
  const byGcc = new Map(), byName = new Map()
  students.forEach(s => {
    const g = gccDigits(s.gcc_no); if (g && !byGcc.has(g)) byGcc.set(g, s)
    const n = normName(s.name); if (n) { if (!byName.has(n)) byName.set(n, []); byName.get(n).push(s) }
  })
  return (name, gcc, batch) => {
    const g = gccDigits(gcc)
    if (g && byGcc.has(g)) return byGcc.get(g)
    const exact = byName.get(normName(name)) || []
    if (exact.length === 1) return exact[0]
    const pool = exact.length > 1 ? exact : students.filter(s => nameCompat(name, s.name, true))
    if (pool.length === 1) return pool[0]
    if (pool.length > 1 && batch) {
      const b = normName(batch)
      const inBatch = pool.filter(s => normName(s.class_name || s.course || '').includes(b) || b.includes(normName(s.class_name || '')))
      if (inBatch.length === 1) return inBatch[0]
    }
    return null
  }
}

const slim = s => s ? { gcc: s.gcc_no || '', photo: s.photo_url || '', phone: String(s.parent_phone || s.phone || '').trim() } : null

export default function CertificateMakerPortal({ currentUser, file = FILE, title = 'Certificate Maker' }) {
  const ref = useRef(null)
  const cache = useRef({ rows: null, students: null })

  useEffect(() => {
    const post = msg => ref.current?.contentWindow?.postMessage(msg, window.location.origin)

    const mockRows = async () => {
      if (!cache.current.rows) { const { rows } = await loadAll(); cache.current.rows = rows || [] }
      return cache.current.rows
    }
    const students = async () => {
      if (!cache.current.students) cache.current.students = await signPhotos(await getAllStudents('*'))
      return cache.current.students
    }

    const onMessage = async e => {
      if (e.origin !== window.location.origin || e.source !== ref.current?.contentWindow) return
      const m = e.data || {}
      try {
        if (m.type === 'gnsi-cert:hello') {
          const rows = await mockRows()
          const tests = new Map()
          rows.forEach(r => {
            const k = testKey(r)
            if (!tests.has(k)) tests.set(k, { key: k, series: r.series, test_no: r.test_no, test_name: r.test_name || '', test_date: r.test_date || '', batch: r.batch, count: 0 })
            tests.get(k).count++
          })
          const list = [...tests.values()].sort((a, b) => (String(b.test_date).localeCompare(String(a.test_date))) || (b.test_no - a.test_no) || a.batch.localeCompare(b.batch))
          post({ type: 'gnsi-cert:portal', tests: list, user: currentUser?.name || currentUser?.username || '' })
        }
        if (m.type === 'gnsi-cert:load-test') {
          const rows = (await mockRows()).filter(r => testKey(r) === m.key)
          if (!rows.length) { post({ type: 'gnsi-cert:error', message: 'No results stored for that test.' }); return }
          const match = makeMatcher(await students())
          const first = rows[0]
          let matched = 0
          const list = rows.map(r => {
            const st = match(r.student_name, r.gcc_no, r.batch); if (st) matched++
            return { name: r.student_name, gcc: r.gcc_no || st?.gcc_no || '', rank: r.rank ?? '', total: Number(r.total) || 0, marks: r.marks || {}, ...(st ? { photo: st.photo_url || '', phone: slim(st).phone } : {}) }
          })
          post({
            type: 'gnsi-cert:test',
            meta: { series: first.series, test_no: first.test_no, test_name: first.test_name || '', test_date: first.test_date || '', batch: first.batch, max_total: Number(first.max_total) || 0, max_marks: first.max_marks || {} },
            students: list, matched,
          })
        }
        if (m.type === 'gnsi-cert:match') {
          const match = makeMatcher(await students())
          const out = (m.names || []).map(x => ({ i: x.i, ...(slim(match(x.name, x.gcc, x.batch)) || {}) }))
          post({ type: 'gnsi-cert:matched', list: out })
        }
      } catch (err) {
        post({ type: 'gnsi-cert:error', message: err?.message || String(err) })
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [currentUser])

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', background: '#fff' }}>
      <iframe ref={ref} title={title} src={file} style={{ flex: 1, minHeight: 0, width: '100%', border: 0, background: '#fff' }} />
    </div>
  )
}
