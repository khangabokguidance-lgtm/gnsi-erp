// MissionFoundationBanner.jsx — poster / banner of Mission Foundation with the photos of every question setter.
import { useMemo, useState } from 'react'
import { findStaffPhoto, useStaffPhotos } from './staffPhotos'
import { setterList, bannerHtml } from './lib/missionFoundationBanner'
import { SUBJECTS, MISSION_NAME, titled, cleanTeacherName } from './missionFoundationData'
import { denyPrint } from './lib/printGuard.js'

const abs = u => { try { return u ? new URL(u, window.location.href).href : '' } catch { return u || '' } }

export default function MissionFoundationBanner({ panel, photoOf = x => x, institute = {}, onClose }) {
  useStaffPhotos()
  const [layout, setLayout] = useState('poster')
  const order = SUBJECTS.map(s => s.label)
  // Not memoised on the panel alone: the ERP staff photos load a moment after the dialog opens (useStaffPhotos re-renders us then).
  const people = setterList(panel, order).map(p => {
    const clean = cleanTeacherName(p.name)
    return { ...p, label: titled(clean), photo: abs(findStaffPhoto(photoOf(clean) || clean) || findStaffPhoto(clean)) || null }
  })
  const sig = people.map(p => p.name + '|' + (p.photo || '')).join(';')
  const customLogo = /^(https:\/\/|data:image\/)/.test(institute.logoUrl || '')   // the school's own logo from settings, else the GNSI lockup (it already carries the name)
  const logo = customLogo ? institute.logoUrl : abs('/gnsi-logo-top.webp')
  const args = { people, layout, title: 'Mission Foundation', session: (MISSION_NAME.match(/\d{4}-\d{2}/) || ['2026-27'])[0], institute: institute.name || 'Guidance Navodaya & Sainik Institute', logo, lockup: !customLogo }
  const html = useMemo(() => bannerHtml(args), [sig, layout]) // eslint-disable-line react-hooks/exhaustive-deps
  const print = () => {
    if (denyPrint()) return
    const w = window.open('', '_blank'); if (!w) return alert('Allow pop-ups to print the banner.')
    w.document.write(bannerHtml({ ...args, auto: true })); w.document.close()
  }
  const noPhoto = people.filter(p => !p.photo).length
  return (
    <div role="dialog" aria-label="Mission Foundation poster banner" onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(14,32,63,.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 16, width: 'min(1000px,100%)', maxHeight: '94vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 12, flexWrap: 'wrap', borderBottom: '1px solid #eef1f6' }}>
          <b style={{ fontSize: 15 }}>🖼️ Mission Foundation — Question Setters</b>
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            {[['poster', 'Poster (A3 portrait)'], ['banner', 'Banner (A3 wide)']].map(([k, l]) => <button key={k} type="button" className={'px-btn ' + (layout === k ? 'gold' : 'ghost')} onClick={() => setLayout(k)}>{l}</button>)}
            <button type="button" className="px-btn gold" disabled={!people.length} onClick={print}>🖨 Print / Save PDF</button>
            <button type="button" className="px-btn ghost" onClick={onClose}>Close</button>
          </span>
        </div>
        {!people.length ? <div style={{ padding: 24, color: '#6b7280' }}>No question setters on the panel yet. Add teachers first.</div> : <>
          {noPhoto > 0 && <div role="status" style={{ padding: '6px 12px', background: '#fff7e6', fontSize: 12.5, color: '#92400e' }}>{noPhoto} setter(s) have no photo in the staff list yet, so initials are shown.</div>}
          <iframe title="Banner preview" srcDoc={html} style={{ border: 0, width: '100%', height: '70vh', background: '#cfd4dc' }} />
        </>}
      </div>
    </div>
  )
}
