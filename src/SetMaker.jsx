// SetMaker.jsx — Learning Hub → Model Set Maker.
// Makes a new Navodaya (JNV Class VI) model set every time: a printable A4
// question booklet, its answer key and an OMR sheet, drawn from a built-in bank
// with fresh numbers and figures in every set, plus questions staff add.
// The maker is one self-contained page,
// public/model-papers/navodaya-model-set-maker.html, shown here in an iframe. It
// finds window.__gnsiSetMaker (setMakerBridge.js) on this window and keeps the
// added questions and passages in the set_maker_items table
// (supabase/migrations/20261044_set_maker_items.sql), so all staff share them.
//
// perms — { read, add, edit, delete } for the 'setmaker' module; add or edit
// lets a user add and delete their own questions. Everyone who can read it can
// make sets and download the PDFs.
import { useLayoutEffect, useRef } from 'react'
import { supabase } from './supabase'
import html2canvasUrl from 'html2canvas/dist/html2canvas.min.js?url'
import { createSetMakerBridge } from './setMakerBridge'

const PAGE = `${import.meta.env.BASE_URL}model-papers/navodaya-model-set-maker.html`

const exportLibs = async () => {
  const { jsPDF } = await import('jspdf')
  return { jsPDF, html2canvasUrl: new URL(html2canvasUrl, window.location.href).href }
}
const saveFile = (filename, blob) => {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export default function SetMaker({ currentUser, perms }) {
  const canWrite = !!(perms?.add || perms?.edit)
  const actor = currentUser?.username || currentUser?.name || null
  const canWriteRef = useRef(canWrite)
  const actorRef = useRef(actor)
  useLayoutEffect(() => { canWriteRef.current = canWrite; actorRef.current = actor }, [canWrite, actor])
  // The page reads the bridge once, while its script starts. Layout effects run
  // as the iframe is inserted, before its document has loaded, so it is there in time.
  useLayoutEffect(() => {
    const bridge = createSetMakerBridge({
      client: supabase,
      canWrite: () => canWriteRef.current,
      actor: () => actorRef.current,
      exportLibs,
      saveFile,
    })
    window.__gnsiSetMaker = bridge
    return () => { if (window.__gnsiSetMaker === bridge) delete window.__gnsiSetMaker }
  }, [])

  return (
    <div style={{ padding: '12px 16px 16px' }}>
      <iframe
        title="Model Set Maker"
        src={PAGE}
        style={{
          display: 'block', width: '100%', height: 'calc(100dvh - 150px)', minHeight: 620,
          border: '1px solid #e5e0d4', borderRadius: 16, background: '#e9edf1',
          boxShadow: '0 1px 2px rgba(19,42,79,.05), 0 14px 30px -22px rgba(19,42,79,.4)',
        }}
      />
    </div>
  )
}
