// MissionFoundationFaces.jsx — staff photos for Mission Foundation: the teacher's photo (from the staff photo system) beside their name.
import { Avatar } from './MissionSainikUI'
import { PX } from './premiumUI'
import { titled } from './missionFoundationData'

// A row of photos + names: "Setters  (photo) Sir Kabiraj  (photo) Sir Lenin".
export function Faces({ label, names = [], photoOf = x => x, size = 38 }) {
  const list = [...new Set((names || []).filter(Boolean))]
  if (!list.length) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {label && <small style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase', color: PX.sub }}>{label}</small>}
      {list.map(n => (
        <span key={n} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          <Avatar name={n} photoName={photoOf(n)} size={size} /><b style={{ fontSize: 13.5, color: PX.ink }}>{titled(n)}</b>
        </span>))}
    </span>
  )
}

// Wraps a form control (a select) with the photo of the person chosen in it.
export function WithFace({ name, photoOf = x => x, size = 34, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {name ? <Avatar name={name} photoName={photoOf(name)} size={size} /> : <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', border: '2px dashed #cfd6e4', flex: 'none' }} />}
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
    </div>
  )
}
