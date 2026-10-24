// ModelSets.jsx — Learning Hub → Model Sets.
// JNV-style practice papers: take Set 1 (or any saved set) with an OMR sheet,
// timer and section-wise score, and build new sets with the set maker.
// The paper and the maker are one self-contained page,
// public/model-papers/jnv-practice-set-1.html, shown here in an iframe. It
// finds window.__gnsiModelSets (modelSetsBridge.js) on this window and keeps
// its sets in the model_sets table (supabase/migrations/20261041_model_sets.sql),
// so every staff member sees the same sets.
//
// perms — { read, add, edit, delete } for the 'modelsets' module; add or edit
// shows the maker (New model set, Edit, Duplicate, Delete).
// Download PDF / Word (8 A4 pages by default) is built inside the page; the
// portal lends it jsPDF and docx, and the URL of its own html2canvas file, so it
// works offline too. html2canvas is loaded INTO the page's frame: run from this
// window it draws on a canvas that cannot see the page's fonts (Literata, BMEI04).
// Import paper (PDF or photos → questions) reads each page with Gemini
// through api/gemini.js (page images are handled in api/_gemini/vision.js).
// Translate to Meetei Mayek uses mayekTranslate.js (school dictionary first,
// then Bhashini / Google / Gemini); the page draws the Mayek text in BMEI04.
import { useLayoutEffect, useRef } from 'react'
import { supabase } from './supabase'
import { authFetch } from './apiFetch'
import html2canvasUrl from 'html2canvas/dist/html2canvas.min.js?url'
import { createModelSetsBridge } from './modelSetsBridge'

const PAGE = `${import.meta.env.BASE_URL}model-papers/jnv-practice-set-1.html`

const exportLibs = async () => {
  const [{ jsPDF }, docx] = await Promise.all([import('jspdf'), import('docx')])
  return { jsPDF, docx, html2canvasUrl: new URL(html2canvasUrl, window.location.href).href }
}
const vision = async (prompt, images) => {
  const res = await authFetch('/api/gemini', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, images }),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    const code = res.status === 429 ? 'rate_limited' : res.status === 401 || res.status === 403 ? 'not_granted' : 'upstream_error'
    throw { code, message: body.error || `HTTP ${res.status}` }
  }
  return body.text
}
// texts[] (no newlines) → the same number of Manipuri lines, in chunks so each
// request stays small; a line the engines could not translate comes back as it was
const TRANSLATE_CHUNK = 60
const translateMM = async (texts, onProgress) => {
  const { translate } = await import('./mayekTranslate')
  const out = []
  for (let i = 0; i < texts.length; i += TRANSLATE_CHUNK) {
    const chunk = texts.slice(i, i + TRANSLATE_CHUNK).map((t) => String(t).replace(/\s*\n\s*/g, ' ').trim())
    const r = await translate(chunk.join('\n'), 'en', 'mni-Mtei', null, { eachLine: true })
    const lines = String(r.text || '').split('\n')
    chunk.forEach((t, k) => out.push(lines.length === chunk.length && lines[k]?.trim() ? lines[k].trim() : t))
    onProgress?.(Math.min(texts.length, i + TRANSLATE_CHUNK), texts.length)
  }
  return out
}
const saveFile = (filename, blob) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export default function ModelSets({ currentUser, perms }) {
  const canWrite = !!(perms?.add || perms?.edit)
  const actor = currentUser?.username || currentUser?.name || null
  const canWriteRef = useRef(canWrite)
  const actorRef = useRef(actor)
  useLayoutEffect(() => { canWriteRef.current = canWrite; actorRef.current = actor }, [canWrite, actor])
  // The page reads the bridge once, while its script starts. Layout effects run
  // as the iframe is inserted, before its document has loaded, so it is there in time.
  useLayoutEffect(() => {
    const bridge = createModelSetsBridge({
      client: supabase,
      canWrite: () => canWriteRef.current,
      actor: () => actorRef.current,
      exportLibs,
      saveFile,
      vision,
      translate: translateMM,
    })
    window.__gnsiModelSets = bridge
    return () => { if (window.__gnsiModelSets === bridge) delete window.__gnsiModelSets }
  }, [])

  return (
    <div style={{ padding: '12px 16px 16px' }}>
      <iframe
        title="Model Sets"
        src={PAGE}
        style={{
          display: 'block', width: '100%', height: 'calc(100dvh - 150px)', minHeight: 620,
          border: '1px solid #e5e0d4', borderRadius: 16, background: '#dde5e2',
          boxShadow: '0 1px 2px rgba(19,42,79,.05), 0 14px 30px -22px rgba(19,42,79,.4)',
        }}
      />
    </div>
  )
}
