import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { AuthProvider } from './AuthContext.jsx'

// A new version was published while this page was open: the screen it
// tries to open no longer exists under its old file name ("Failed to fetch
// dynamically imported module"). Reload once to pick up the new version.
// The time guard stops a reload loop if the file is missing for another
// reason (e.g. the connection is down).
window.addEventListener('vite:preloadError', e => {
  let last = 0
  try { last = Number(sessionStorage.getItem('gnsi_reloaded_for_update')) || 0 } catch { /* storage blocked */ }
  if (Date.now() - last < 60 * 1000) return
  try { sessionStorage.setItem('gnsi_reloaded_for_update', String(Date.now())) } catch { /* storage blocked */ }
  e.preventDefault()
  window.location.reload()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)

if("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js")
    .then(r => console.log("[SW] Registered:", r.scope))
    .catch(e => console.error("[SW] Failed:", e))
}
