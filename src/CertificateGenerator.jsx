import React, { useEffect, useRef, useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────────
// CertificateGenerator — GNSI Batch Certificate Generator
// Rendered inside a sandboxed iframe to isolate CSS/JS from ERP shell.
// Props:
//   currentUser  — from App.jsx (role, name)
//   perms        — from App.jsx permission map
// ─────────────────────────────────────────────────────────────────────────────

export default function CertificateGenerator({ currentUser, perms }) {
  const iframeRef  = useRef(null)
  const blobUrlRef = useRef(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [iframeKey, setIframeKey] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError(null)

    fetch('/certificate.html')
      .then(r => {
        if (!r.ok) throw new Error('certificate.html not found in /public/')
        return r.text()
      })
      .then(html => {
        // Safely inject user data — no template literal nesting issues
        const userData     = JSON.stringify({ name: currentUser?.name || '', role: currentUser?.role || '' })
        const injectScript = '<scr' + 'ipt>window.__GNSI_USER__ = ' + userData + '</scr' + 'ipt>'
        const enriched     = html.replace('<!-- GNSI_USER_INJECT -->', injectScript)

        const blob = new Blob([enriched], { type: 'text/html' })
        if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
        blobUrlRef.current = URL.createObjectURL(blob)

        setIframeKey(k => k + 1)   // remount iframe with fresh blob
        setLoading(false)
      })
      .catch(err => {
        console.error('[CertificateGenerator] Load error:', err)
        setError(err.message)
        setLoading(false)
      })

    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current)
    }
  }, [currentUser])

  // ── Permission guard ──────────────────────────────────────────────────────
  const isAdmin   = currentUser?.role === 'Admin'
  const isManager = currentUser?.role === 'Manager'
  if (!isAdmin && !isManager && !perms?.read) {
    return (
      <div style={S.denied}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>🚫</div>
        <h2 style={{ color: '#dc2626', marginBottom: 8 }}>Access Denied</h2>
        <p style={{ color: '#94a3b8' }}>You don't have permission to use the Certificate Generator.</p>
      </div>
    )
  }

  return (
    <div style={S.wrapper}>

      {/* ── ERP-shell header bar ── */}
      <div style={S.header}>
        <div style={S.headerLeft}>
          <span style={{ fontSize: 22 }}>📜</span>
          <div>
            <div style={S.headerTitle}>Certificate Generator</div>
            <div style={S.headerSub}>GNSI Batch Certificate · 2026</div>
          </div>
        </div>
        <div style={S.headerRight}>
          <span style={S.roleBadge}>{currentUser?.role}</span>
          <button
            style={S.reloadBtn}
            onClick={() => { setLoading(true); setIframeKey(k => k + 1) }}
            title="Reload generator"
          >
            ↺ Reload
          </button>
          <button
            style={S.fullBtn}
            onClick={() => iframeRef.current?.requestFullscreen?.()}
            title="Open fullscreen"
          >
            ⛶ Fullscreen
          </button>
        </div>
      </div>

      {/* ── Error state ── */}
      {error && (
        <div style={S.errorBox}>
          <strong>⚠ Could not load certificate.html</strong>
          <br />
          <span style={{ fontSize: 11, opacity: 0.8 }}>{error}</span>
          <br />
          <span style={{ fontSize: 10, opacity: 0.6 }}>
            Make sure <code>public/certificate.html</code> exists in your Vite project root.
          </span>
        </div>
      )}

      {/* ── Loading overlay ── */}
      {loading && !error && (
        <div style={S.loadingOverlay}>
          <div style={S.spinner} />
          <span style={{ color: '#C9992A', fontSize: 13, marginTop: 14, letterSpacing: 2 }}>
            Loading Certificate Generator…
          </span>
        </div>
      )}

      {/* ── The certificate generator, fully isolated in an iframe ── */}
      {!error && (
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={blobUrlRef.current || 'about:blank'}
          style={{ ...S.iframe, opacity: loading ? 0 : 1, transition: 'opacity 0.35s ease' }}
          title="GNSI Certificate Generator"
          onLoad={() => setLoading(false)}
          allow="fullscreen"
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const S = {
  wrapper: {
    display: 'flex', flexDirection: 'column',
    height: 'calc(100vh - 48px)', // subtract ERP top bar height
    background: '#03263a', overflow: 'hidden', position: 'relative',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '10px 20px', flexShrink: 0,
    background: 'linear-gradient(90deg, #021e2e 0%, #03263a 100%)',
    borderBottom: '1px solid rgba(194,153,42,0.25)',
  },
  headerLeft:  { display: 'flex', alignItems: 'center', gap: 12 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 8 },
  headerTitle: {
    fontSize: 14, fontWeight: 700, color: '#F5E8B8',
    fontFamily: 'Cinzel, serif', letterSpacing: '0.05em',
  },
  headerSub: {
    fontSize: 10, color: '#6b8fa8',
    letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 2,
  },
  roleBadge: {
    fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
    background: 'rgba(194,153,42,0.12)', border: '1px solid rgba(194,153,42,0.3)',
    borderRadius: 4, padding: '3px 8px', color: '#C9992A',
  },
  reloadBtn: {
    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 6, padding: '5px 12px', color: '#94afc4',
    fontSize: 11, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.05em',
  },
  fullBtn: {
    background: 'rgba(194,153,42,0.1)', border: '1px solid rgba(194,153,42,0.3)',
    borderRadius: 6, padding: '5px 12px', color: '#C9992A',
    fontSize: 11, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.05em',
  },
  iframe: {
    flex: 1, width: '100%', border: 'none', display: 'block',
  },
  loadingOverlay: {
    position: 'absolute', inset: 0, top: 50,
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    background: 'rgba(3,38,58,0.95)', zIndex: 10,
  },
  spinner: {
    width: 36, height: 36,
    border: '3px solid rgba(194,153,42,0.2)', borderTop: '3px solid #C9992A',
    borderRadius: '50%', animation: 'gnsiSpin 0.8s linear infinite',
  },
  errorBox: {
    margin: 24, padding: '14px 18px',
    background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.3)',
    borderRadius: 8, color: '#fca5a5', fontSize: 12, lineHeight: 1.7,
  },
  denied: {
    padding: 48, textAlign: 'center', color: '#94a3b8',
  },
}

// Inject spinner keyframe once
if (typeof document !== 'undefined' && !document.getElementById('gnsi-cert-spin')) {
  const style = document.createElement('style')
  style.id = 'gnsi-cert-spin'
  style.textContent = '@keyframes gnsiSpin { to { transform: rotate(360deg) } }'
  document.head.appendChild(style)
}