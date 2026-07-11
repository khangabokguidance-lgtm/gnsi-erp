// CastReceiver.jsx — GNSI Portal
// Standalone receiver page for the Teaching Aids "Cast to TV" feature.
//
// Mount this at the route /cast-receiver (matching `receiverPath` passed to
// useCastToTV in TeachingAids.jsx). It is NOT part of the normal portal
// shell/nav — it's a bare full-screen page meant to be opened by the browser
// automatically on a Chromecast / DIAL Android TV via the W3C Presentation
// API, not visited directly by users.
//
// HOW IT GETS ITS DATA:
// The controlling tab (TeachingAids.jsx SecureViewer) builds a URL like:
//   https://yourportal.com/cast-receiver#data=<base64-encoded-json>
// where the JSON is { title, pages: [signedUrl, ...], idx, wm, batch }.
// The Presentation API loads that exact URL as the receiver page, so we can
// read the initial state straight from location.hash on mount.
//
// STAYING IN SYNC:
// After the initial load, page turns are pushed over the live
// PresentationConnection (not by reloading the hash) — see
// navigator.presentation.receiver.connectionList below. This receiver:
//   1. Waits for navigator.presentation.receiver to resolve a connection
//   2. Listens for 'message' events shaped { type: 'page', idx },
//      { type: 'refresh', pages }, or { type: 'nightMode', on }
//   3. Also handles 'terminate' — connection is a live object,
//      cleans up listeners on connection close.
//
// NIGHT MODE: the controlling KindleReader sends { type: 'nightMode', on }
// whenever the student toggles night mode on their own screen, so the
// classroom TV mirrors the same dark/inverted display rather than staying
// bright while the student's own view is dimmed.
//
// SECURITY NOTE: signed URLs baked into the initial hash expire after the
// same short TTL as everywhere else in this module (5 min). If a class runs
// long, the controlling tab should periodically refresh and re-send fresh
// signed URLs via a { type: 'refresh', pages: [...] } message — handled below.
//
// This page intentionally has no navigation, no close button tied to the
// portal's router, and no way to reach other portal data — it only ever
// knows what's been pushed to it.

import React, { useState, useEffect, useRef, useMemo } from 'react'

const C = {
  bg: '#0a0f19',
  slate: '#94a3b8',
}

function decodeHashPayload() {
  try {
    const hash = window.location.hash || ''
    const match = hash.match(/data=([^&]+)/)
    if (!match) return null
    const json = decodeURIComponent(escape(atob(decodeURIComponent(match[1]))))
    return JSON.parse(json)
  } catch {
    return null
  }
}

// ── Deterrence styling — same intent as the controller-side viewer.
// A cast receiver is still a shared classroom screen showing student
// materials, so the same "no casual copy" posture applies, understanding
// that a phone camera pointed at a TV can never be stopped by software.
function GuardStyles() {
  return (
    <style>{`
      html, body, #root { margin:0; padding:0; height:100%; background:#0a0f19; }
      * { -webkit-user-select:none; -moz-user-select:none; user-select:none; -webkit-touch-callout:none; }
      img, canvas { pointer-events:none; -webkit-user-drag:none; user-drag:none; }
      @media print { body::before { content:"Printing disabled"; } body > * { display:none !important; } }
    `}</style>
  )
}

function WatermarkOverlay({ label }) {
  const tiles = useMemo(() => new Array(30).fill(0), [])
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden',
      display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', zIndex: 5,
    }}>
      {tiles.map((_, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transform: 'rotate(-28deg)', opacity: 0.10, fontSize: 22, fontWeight: 700,
          color: '#ffffff', whiteSpace: 'nowrap', padding: '40px 0',
        }}>
          {label}
        </div>
      ))}
    </div>
  )
}

export default function CastReceiver() {
  const [state, setState] = useState(() => decodeHashPayload())
  const [connectionStatus, setConnectionStatus] = useState('waiting') // waiting | connected | closed
  const [error, setError] = useState(null)
  const connectionRef = useRef(null)

  // Wire up the Presentation API receiver side. This is how we get *live*
  // page-turn messages from the controller tab without reloading anything.
  useEffect(() => {
    if (!('presentation' in navigator) || !navigator.presentation.receiver) {
      // Not actually running as a presentation receiver (e.g. someone opened
      // this URL directly in a normal tab for testing). Fall back to the
      // hash-decoded state only — no live sync possible.
      setConnectionStatus('no-receiver-api')
      return
    }

    let cleanup = () => {}

    navigator.presentation.receiver.connectionList.then((list) => {
      const attach = (connection) => {
        connectionRef.current = connection
        setConnectionStatus('connected')

        const onMessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            if (msg.type === 'page') {
              setState(prev => prev ? { ...prev, idx: msg.idx } : prev)
            } else if (msg.type === 'refresh') {
              setState(prev => prev ? { ...prev, pages: msg.pages } : prev)
            } else if (msg.type === 'nightMode') {
              // Sent whenever the controlling reader's night-mode toggle
              // changes, so the classroom TV matches what the student sees
              // on their own screen.
              setState(prev => prev ? { ...prev, nightMode: !!msg.on } : prev)
            } else if (msg.type === 'replace') {
              // Full state swap — e.g. teacher opened a different aid while casting.
              setState(msg.payload)
            }
          } catch {
            // Ignore malformed messages rather than crashing the receiver view.
          }
        }
        const onClose = () => setConnectionStatus('closed')

        connection.addEventListener('message', onMessage)
        connection.addEventListener('close', onClose)
        connection.addEventListener('terminate', onClose)

        cleanup = () => {
          connection.removeEventListener('message', onMessage)
          connection.removeEventListener('close', onClose)
          connection.removeEventListener('terminate', onClose)
        }
      }

      // There may already be a connection waiting, or one may arrive shortly.
      list.forEach(attach)
      navigator.presentation.receiver.connectionList.then(() => {})
      navigator.presentation.receiver.onconnectionavailable = attach
    }).catch((err) => {
      setError(err?.message || 'Could not attach to presentation connection')
    })

    return () => cleanup()
  }, [])

  if (!state) {
    return (
      <div style={{ ...fullScreenCenter, color: C.slate }}>
        <GuardStyles />
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📺</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Waiting for a teaching aid to be cast…</div>
          {error && <div style={{ fontSize: 12, marginTop: 10, color: '#f87171' }}>{error}</div>}
        </div>
      </div>
    )
  }

  const { title, pages = [], idx = 0, wm = '', batch = '', nightMode = false } = state
  const currentUrl = pages[idx] || pages[0]
  const total = pages.length

  return (
    <div style={{ ...fullScreenCenter, flexDirection: 'column', padding: 0 }}>
      <GuardStyles />

      {/* Minimal top strip — no controls, this is display-only */}
      <div style={{
        width: '100%', padding: '18px 32px', display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', color: '#fff', flexShrink: 0, boxSizing: 'border-box',
      }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>{title}</div>
        <div style={{ fontSize: 14, color: C.slate }}>
          {batch}{total > 1 ? ` · Page ${idx + 1} of ${total}` : ''}
        </div>
      </div>

      {connectionStatus === 'no-receiver-api' && (
        <div style={{ color: '#fbbf24', fontSize: 13, marginBottom: 8 }}>
          Opened outside a Presentation session — showing static content, live page-sync is unavailable.
        </div>
      )}
      {connectionStatus === 'closed' && (
        <div style={{ color: '#f87171', fontSize: 13, marginBottom: 8 }}>
          Casting session ended.
        </div>
      )}

      <div style={{ flex: 1, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', minHeight: 0, background: nightMode ? '#000' : 'transparent' }}>
        <div style={{ position: 'relative', maxHeight: '100%', maxWidth: '92%' }}>
          <img
            src={currentUrl}
            alt=""
            draggable={false}
            onContextMenu={e => e.preventDefault()}
            style={{
              maxHeight: '78vh', maxWidth: '100%', objectFit: 'contain', borderRadius: 8,
              boxShadow: '0 8px 40px rgba(0,0,0,.5)', display: 'block',
              filter: nightMode ? 'invert(1) hue-rotate(180deg) brightness(.92)' : 'none',
            }}
          />
          <WatermarkOverlay label={wm} />
        </div>
      </div>

      <div style={{ padding: '10px 32px', color: '#475569', fontSize: 11, textAlign: 'center', flexShrink: 0 }}>
        GNSI Teaching Aids · For classroom display only · Do not photograph or record this screen
      </div>
    </div>
  )
}

const fullScreenCenter = {
  position: 'fixed', inset: 0, background: C.bg, display: 'flex',
  alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui,sans-serif',
}