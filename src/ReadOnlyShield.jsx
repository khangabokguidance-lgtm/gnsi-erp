// ReadOnlyShield.jsx — wraps a module so a user who may only READ it cannot save, add, edit, approve or delete.
// Shows a "View only" bar and blocks write controls (clicks, form submits) inside the module.
import { useEffect, useRef } from 'react'
import { isWriteControl } from './lib/readOnlyShield'

export default function ReadOnlyShield({ label = 'this module', children }) {
  const box = useRef(null)
  useEffect(() => {
    const el = box.current
    if (!el) return undefined
    const stop = (e) => { e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation(); try { window.alert(`You have view-only access to ${label}. Ask an admin for edit rights to make changes.`) } catch { /* ignore */ } }
    const onClick = (e) => { if (isWriteControl(e.target)) stop(e) }
    const onSubmit = (e) => stop(e)
    el.addEventListener('click', onClick, true)
    el.addEventListener('submit', onSubmit, true)
    return () => { el.removeEventListener('click', onClick, true); el.removeEventListener('submit', onSubmit, true) }
  }, [label])
  return (
    <div ref={box}>
      <div role="status" style={{ background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e', borderRadius: 10, padding: '8px 14px', margin: '0 0 10px', fontSize: 13, fontWeight: 600 }}>
        👁 View only — your account can look at {label} but not change anything.
      </div>
      {children}
    </div>
  )
}
