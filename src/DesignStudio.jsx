import { useState } from 'react'
import InvitationGenerator from './InvitationGenerator'
import CertificateGenerator from './CertificateGenerator'
import TeachersDayFrame from './TeachersDayFrame'

// Design Studio — one home for every design / print tool.
// Banner Maker is a self-contained editor served from /design-studio/banner-maker.html
// (fonts, logos and export libraries are embedded, so it works offline and has no
// dependency on the portal's data). The other tabs reuse the existing modules.
const BANNER_URL = '/design-studio/banner-maker.html'
const INV_URL = '/design-studio/invitation-maker.html'

const TABS = [
  { id: 'banner',      label: 'Banner Maker',  icon: '🖼️', perm: 'designstudio' },
  { id: 'invmaker',    label: 'Invitation Maker', icon: '💌', perm: 'designstudio' },
  { id: 'invitation',  label: 'Invitation',    icon: '✉️', perm: 'invitation' },
  { id: 'certificate', label: 'Certificates',  icon: '📜', perm: 'certificate' },
  { id: 'teachersday', label: "Teachers' Day", icon: '🎓', perm: 'teachersday' },
]

const NAVY = '#0B1E3D', GOLD = '#C9A24B'

export default function DesignStudio({ currentUser, perms, canAccess }) {
  const visible = TABS.filter(t => !canAccess || canAccess(t.perm))
  const [tab, setTab] = useState(visible[0]?.id)
  const [full, setFull] = useState(false)
  if (!visible.length) return <div style={{ padding: 24 }}>You don’t have access to Design Studio.</div>
  const active = visible.find(t => t.id === tab) || visible[0]

  const body = {
    banner: (
      <div style={full
        ? { position: 'fixed', inset: 0, zIndex: 3000, background: '#fff', display: 'flex', flexDirection: 'column' }
        : { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', background: '#f7f3e8', borderBottom: `1px solid ${GOLD}55`, fontSize: 12, color: NAVY }}>
          <span style={{ flex: 1 }}>Full editor — text, images, shapes, templates (7×21 ft, 4×8 ft portrait, A4…), export PNG / TIFF / PDF. Designs auto-save in this browser.</span>
          <button onClick={() => window.open(BANNER_URL, '_blank')} style={btn}>Open in new tab</button>
          <button onClick={() => setFull(f => !f)} style={btn}>{full ? 'Exit full screen' : 'Full screen'}</button>
        </div>
        <iframe title="Banner Maker" src={BANNER_URL} style={{ flex: 1, minHeight: 0, width: '100%', border: 0, background: '#fff' }} />
      </div>
    ),
    invmaker: (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '6px 10px', background: '#f7f3e8', borderBottom: `1px solid ${GOLD}55`, fontSize: 12, color: NAVY }}>
          <span style={{ flex: 1 }}>Invitation Maker — standalone editor.</span>
          <button onClick={() => window.open(INV_URL, '_blank')} style={btn}>Open in new tab</button>
        </div>
        <iframe title="Invitation Maker" src={INV_URL} style={{ flex: 1, minHeight: 0, width: '100%', border: 0, background: '#fff' }} />
      </div>
    ),
    invitation:  <InvitationGenerator currentUser={currentUser} />,
    certificate: <CertificateGenerator currentUser={currentUser} perms={perms ? perms('certificate') : undefined} />,
    teachersday: <TeachersDayFrame />,
  }[active.id]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 60px)', minHeight: 560 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 14px 0', background: NAVY, borderBottom: `3px solid ${GOLD}`, flexWrap: 'wrap' }}>
        <div style={{ color: GOLD, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 18, marginRight: 14, paddingBottom: 8 }}>🎨 Design Studio</div>
        {visible.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{ border: 0, cursor: 'pointer', padding: '9px 16px', borderRadius: '10px 10px 0 0', fontWeight: 600, fontSize: 13,
              background: t.id === active.id ? '#fff' : 'transparent', color: t.id === active.id ? NAVY : '#dfe6f5' }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: (active.id === 'banner' || active.id === 'invmaker') ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}>{body}</div>
    </div>
  )
}

const btn = { border: `1px solid ${GOLD}`, background: '#fff', color: NAVY, borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 600 }
