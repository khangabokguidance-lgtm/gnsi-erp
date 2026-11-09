// CbtFlashControl.jsx — admin switch for the landing-page CBT flash message. Writes the same website_settings keys
// that Website → Settings shows, and the public landing page reads them, so the three places always agree.
import { useEffect, useState } from 'react'
import { getSettings, saveSettings } from './websiteApi'
import { cbtFlashFrom, cbtFlashSettings, nextScheduled, CBT_FLASH_DEFAULT_TEXT } from './lib/cbtFlash'

export default function CbtFlashControl({ canEdit, openTests, rows, flash }) {
  const [st, setSt] = useState(null)          // { on, text, link } as saved
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [now] = useState(() => Date.now())
  const [pick, setPick] = useState(null)       // test id to count down to ('' = none); null until the user chooses
  useEffect(() => {
    let live = true
    getSettings().then(c => { if (!live) return; const f = cbtFlashFrom(c); setSt(f); setText(c?.cbt_flash_text ? f.text : '') }).catch(() => { if (live) setSt({ on: false, text: CBT_FLASH_DEFAULT_TEXT, link: '/exam' }) })
    return () => { live = false }
  }, [])
  if (!st) return null
  const scheduled = (rows || []).filter(r => r.opens_at && Date.parse(r.opens_at) > now && r.status !== 'closed').sort((x, y) => Date.parse(x.opens_at) - Date.parse(y.opens_at))
  const stamp = t => new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
  const chosen = pick !== null ? pick : (st.test && scheduled.some(r => r.id === st.test) ? st.test : (nextScheduled(rows, now)?.id || ''))
  const row = scheduled.find(r => r.id === chosen) || null
  const sched = row ? { at: row.opens_at, end: row.closes_at, label: row.name, test: row.id } : {}
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
        {canEdit && <button className={`btn ${st.on ? '' : 'navy'}`} disabled={busy} onClick={() => write({ on: !st.on, text, link: st.link === '/exam' ? '' : st.link, ...sched })}>{st.on ? 'Switch OFF' : 'Switch ON'}</button>}
      </div>
      <div style={{ marginTop: 10, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ fontSize: 12.5, fontWeight: 700 }}>⏱ Countdown to</label>
        <select className="in" style={{ width: 'auto', maxWidth: '100%' }} disabled={!canEdit} value={chosen} onChange={e => setPick(e.target.value)} aria-label="Test to count down to">
          <option value="">No countdown (show the message only)</option>
          {scheduled.map(r => <option key={r.id} value={r.id}>{r.name} — opens {stamp(r.opens_at)}</option>)}
        </select>
        {!scheduled.length && <span className="muted" style={{ fontSize: 12 }}>No upcoming schedule — set “Opens” when you publish a test in the Online tab.</span>}
        {st.at && st.test && <span className="muted" style={{ fontSize: 12 }}>Now counting to {st.label || 'a test'} · {stamp(st.at)}</span>}
      </div>
      {canEdit && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <input className="in" style={{ flex: '1 1 260px' }} maxLength={200} value={text} placeholder={CBT_FLASH_DEFAULT_TEXT} onChange={e => setText(e.target.value)} aria-label="Flash message text" />
          <button className="btn" disabled={busy} onClick={() => write({ on: st.on, text, link: st.link === '/exam' ? '' : st.link, ...sched })}>Save text</button>
        </div>
      )}
    </div>
  )
}
