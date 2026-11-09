// CbtFlashControl.jsx — admin switch for the landing-page CBT flash message. Writes the same website_settings keys
// that Website → Settings shows, and the public landing page reads them, so the three places always agree.
import { useEffect, useState } from 'react'
import { getSettings, saveSettings } from './websiteApi'
import { cbtFlashFrom, cbtFlashSettings, CBT_FLASH_DEFAULT_TEXT } from './lib/cbtFlash'

export default function CbtFlashControl({ canEdit, openTests, flash }) {
  const [st, setSt] = useState(null)          // { on, text, link } as saved
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let live = true
    getSettings().then(c => { if (!live) return; const f = cbtFlashFrom(c); setSt(f); setText(c?.cbt_flash_text ? f.text : '') }).catch(() => { if (live) setSt({ on: false, text: CBT_FLASH_DEFAULT_TEXT, link: '/exam' }) })
    return () => { live = false }
  }, [])
  if (!st) return null
  const write = async next => {
    setBusy(true)
    const { error } = await saveSettings(cbtFlashSettings(next))
    setBusy(false)
    if (error) return flash?.(`Could not save: ${error.message}`)
    setSt(cbtFlashFrom(cbtFlashSettings(next)))
    flash?.(next.on ? 'Flash message is ON — everyone sees it on the landing page until you switch it off.' : 'Flash message switched OFF.')
  }
  return (
    <div className="card" style={{ marginBottom: 12, borderLeft: `4px solid ${st.on ? '#b42318' : '#cbd5e1'}` }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 240px', minWidth: 0 }}>
          <b>📣 Landing-page flash message</b>
          <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>
            {st.on ? 'ON — shown to every visitor on the website until you switch it off.' : 'OFF — visitors see only the “CBT Exam” menu link.'}
            {openTests != null ? ` · ${openTests} test${openTests === 1 ? '' : 's'} published online.` : ''}
          </div>
        </div>
        {canEdit && <button className={`btn ${st.on ? '' : 'navy'}`} disabled={busy} onClick={() => write({ on: !st.on, text, link: st.link === '/exam' ? '' : st.link })}>{st.on ? 'Switch OFF' : 'Switch ON'}</button>}
      </div>
      {canEdit && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <input className="in" style={{ flex: '1 1 260px' }} maxLength={200} value={text} placeholder={CBT_FLASH_DEFAULT_TEXT} onChange={e => setText(e.target.value)} aria-label="Flash message text" />
          <button className="btn" disabled={busy} onClick={() => write({ on: st.on, text, link: st.link === '/exam' ? '' : st.link })}>Save text</button>
        </div>
      )}
    </div>
  )
}
